import {
  MAX_CLASSIFIER_LABELS,
  scoreWithCategoryModel,
  selectCategories,
  type CategoryModel,
  type CategoryScore,
  type CategorySelectionRule,
} from "@kyomi/worker";

export type TrainingExample = { vector: readonly number[]; label: string };

export type TrainingOptions = {
  epochs: number;
  learningRate: number;
  /** L2 penalty on the weights. */
  l2: number;
  /** Weights each class by the inverse of its frequency so rare categories still count. */
  balanceClasses: boolean;
};

export const DEFAULT_TRAINING_OPTIONS: TrainingOptions = {
  epochs: 300,
  learningRate: 0.05,
  l2: 1e-4,
  balanceClasses: true,
};

function normalized(vector: readonly number[]): Float64Array {
  let norm = 0;
  for (const value of vector) {
    norm += value * value;
  }
  const scale = norm > 0 ? 1 / Math.sqrt(norm) : 0;
  return Float64Array.from(vector, (value) => value * scale);
}

/**
 * Fits a softmax regression head (one weight row and bias per label) with full-batch Adam. Inputs
 * are L2-normalized, matching how `scoreWithCategoryModel` scores them.
 */
export function trainCategoryModel(
  examples: readonly TrainingExample[],
  labels: readonly string[],
  version: string,
  options: TrainingOptions = DEFAULT_TRAINING_OPTIONS,
): CategoryModel {
  if (examples.length === 0) {
    throw new Error("Cannot train a category model without examples");
  }
  const dimensions = examples[0]!.vector.length;
  const classes = labels.length;
  const xs = examples.map((example) => normalized(example.vector));
  const ys = examples.map((example) => {
    const index = labels.indexOf(example.label);
    if (index < 0) {
      throw new Error(`Training label "${example.label}" is not one of the model labels`);
    }
    return index;
  });
  const counts = new Array<number>(classes).fill(0);
  for (const y of ys) {
    counts[y]! += 1;
  }
  const classWeight = counts.map((count) =>
    options.balanceClasses && count > 0 ? examples.length / (classes * count) : 1,
  );

  const weights = new Float64Array(classes * dimensions);
  const bias = new Float64Array(classes);
  const mW = new Float64Array(weights.length);
  const vW = new Float64Array(weights.length);
  const mB = new Float64Array(classes);
  const vB = new Float64Array(classes);
  const beta1 = 0.9;
  const beta2 = 0.999;
  const epsilon = 1e-8;
  const logits = new Float64Array(classes);

  for (let epoch = 1; epoch <= options.epochs; epoch += 1) {
    const gradW = new Float64Array(weights.length);
    const gradB = new Float64Array(classes);
    let totalWeight = 0;
    xs.forEach((x, n) => {
      for (let c = 0; c < classes; c += 1) {
        let sum = bias[c]!;
        const offset = c * dimensions;
        for (let d = 0; d < dimensions; d += 1) {
          sum += weights[offset + d]! * x[d]!;
        }
        logits[c] = sum;
      }
      let max = -Infinity;
      for (let c = 0; c < classes; c += 1) {
        max = Math.max(max, logits[c]!);
      }
      let total = 0;
      for (let c = 0; c < classes; c += 1) {
        logits[c] = Math.exp(logits[c]! - max);
        total += logits[c]!;
      }
      const sampleWeight = classWeight[ys[n]!]!;
      totalWeight += sampleWeight;
      for (let c = 0; c < classes; c += 1) {
        const error = (logits[c]! / total - (c === ys[n] ? 1 : 0)) * sampleWeight;
        gradB[c]! += error;
        const offset = c * dimensions;
        for (let d = 0; d < dimensions; d += 1) {
          gradW[offset + d]! += error * x[d]!;
        }
      }
    });

    const correction1 = 1 - beta1 ** epoch;
    const correction2 = 1 - beta2 ** epoch;
    for (let i = 0; i < weights.length; i += 1) {
      const g = gradW[i]! / totalWeight + options.l2 * weights[i]!;
      mW[i] = beta1 * mW[i]! + (1 - beta1) * g;
      vW[i] = beta2 * vW[i]! + (1 - beta2) * g * g;
      weights[i]! -=
        (options.learningRate * (mW[i]! / correction1)) /
        (Math.sqrt(vW[i]! / correction2) + epsilon);
    }
    for (let c = 0; c < classes; c += 1) {
      const g = gradB[c]! / totalWeight;
      mB[c] = beta1 * mB[c]! + (1 - beta1) * g;
      vB[c] = beta2 * vB[c]! + (1 - beta2) * g * g;
      bias[c]! -=
        (options.learningRate * (mB[c]! / correction1)) /
        (Math.sqrt(vB[c]! / correction2) + epsilon);
    }
  }

  return {
    version,
    labels: [...labels],
    dimensions,
    weights: Float32Array.from(weights),
    bias: Array.from(bias, (value) => Math.fround(value)),
  };
}

export type CrossValidationExample = TrainingExample & {
  /** Examples from one feed share a fold, so a feed's style can't leak from train to test. */
  feedId: string;
  /** The labels a correct prediction may contain: the primary and any secondary, never "none". */
  expected: readonly string[];
  needsReview: boolean;
};

export type RuleScore = {
  rule: CategorySelectionRule;
  precision: number;
  recall: number;
  f1: number;
  abstention: number;
  twoLabelShare: number;
};

export type CrossValidationReport = {
  /** Top category is an expected label, over articles that have one. */
  top1: number;
  /** The same over articles whose label wasn't flagged for review. */
  clearTop1: number;
  /** Selection rules ranked by micro F1 over out-of-fold predictions. */
  rules: RuleScore[];
};

const RULE_FLOORS = Array.from({ length: 28 }, (_, i) => Math.round((0.06 + i * 0.02) * 100) / 100);
const RULE_MARGINS = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, undefined];

/**
 * K-fold cross-validation grouped by feed: trains on the other folds, scores each held-out
 * article, and ranks article selection rules by micro F1 over those out-of-fold predictions.
 */
export function crossValidateCategoryModel(
  examples: readonly CrossValidationExample[],
  labels: readonly string[],
  options: TrainingOptions = DEFAULT_TRAINING_OPTIONS,
  folds = 5,
): CrossValidationReport {
  const feedIds = [...new Set(examples.map((example) => example.feedId))].sort();
  const foldOf = new Map(feedIds.map((feedId, index) => [feedId, index % folds]));
  const predictions = new Map<CrossValidationExample, CategoryScore[]>();
  for (let fold = 0; fold < folds; fold += 1) {
    const model = trainCategoryModel(
      examples.filter((example) => foldOf.get(example.feedId) !== fold),
      labels,
      "cross-validation",
      options,
    );
    for (const example of examples.filter((candidate) => foldOf.get(candidate.feedId) === fold)) {
      predictions.set(example, scoreWithCategoryModel(model, example.vector));
    }
  }

  const labeled = examples.filter((example) => example.expected.length > 0);
  const clear = labeled.filter((example) => !example.needsReview);
  const top1Share = (subset: readonly CrossValidationExample[]) =>
    subset.filter((example) => example.expected.includes(predictions.get(example)![0]!.label))
      .length / Math.max(1, subset.length);

  const rules = RULE_FLOORS.flatMap((minSimilarity) =>
    RULE_MARGINS.map((secondaryMargin) => {
      const rule = { minSimilarity, secondaryMargin };
      let tp = 0;
      let fp = 0;
      let fn = 0;
      let abstained = 0;
      let twoLabels = 0;
      for (const example of examples) {
        const picked = selectCategories(predictions.get(example)!, rule, MAX_CLASSIFIER_LABELS).map(
          (entry) => entry.label,
        );
        abstained += picked.length === 0 ? 1 : 0;
        twoLabels += picked.length > 1 ? 1 : 0;
        tp += picked.filter((label) => example.expected.includes(label)).length;
        fp += picked.filter((label) => !example.expected.includes(label)).length;
        fn += example.expected.filter((label) => !picked.includes(label)).length;
      }
      const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
      const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
      return {
        rule,
        precision,
        recall,
        f1: precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall),
        abstention: abstained / examples.length,
        twoLabelShare: twoLabels / examples.length,
      };
    }),
  ).sort((a, b) => b.f1 - a.f1);

  return { top1: top1Share(labeled), clearTop1: top1Share(clear), rules };
}
