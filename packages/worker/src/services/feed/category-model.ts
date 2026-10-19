import type { CategoryScore } from "./embeddings";

/** The head's abstain class: an article that fits none of the canonical categories. */
export const NO_CATEGORY_CLASS = "none";

/**
 * A softmax classification head over L2-normalized BGE-M3 article vectors, trained on labeled
 * articles by `bun run --cwd apps/api category:train`. Scores are class probabilities.
 */
export type CategoryModel = {
  version: string;
  labels: readonly string[];
  dimensions: number;
  /** labels.length x dimensions, row-major. */
  weights: Float32Array;
  bias: readonly number[];
};

/** The serialized form the trainer writes: weights as base64 little-endian float32. */
export type EncodedCategoryModel = Omit<CategoryModel, "weights"> & { weights: string };

export function decodeCategoryModel(encoded: EncodedCategoryModel): CategoryModel {
  // Copied out of Buffer's shared pool, whose offsets needn't be float-aligned.
  const weights = new Float32Array(Uint8Array.from(Buffer.from(encoded.weights, "base64")).buffer);
  if (weights.length !== encoded.labels.length * encoded.dimensions) {
    throw new Error(`Category model ${encoded.version} has malformed weights`);
  }
  return { ...encoded, weights };
}

export function encodeCategoryModel(model: CategoryModel): EncodedCategoryModel {
  return {
    ...model,
    weights: Buffer.from(
      model.weights.buffer,
      model.weights.byteOffset,
      model.weights.byteLength,
    ).toString("base64"),
  };
}

/**
 * Class probabilities for a vector, best first. The abstain class is left out, so its mass only
 * lowers every category's probability.
 */
export function scoreWithCategoryModel(
  model: CategoryModel,
  vector: readonly number[],
): CategoryScore[] {
  if (vector.length !== model.dimensions) {
    throw new Error(
      `Category model ${model.version} expects ${model.dimensions}-dimensional vectors, got ${vector.length}`,
    );
  }
  let norm = 0;
  for (const value of vector) {
    norm += value * value;
  }
  const scale = norm > 0 ? 1 / Math.sqrt(norm) : 0;
  const logits = model.labels.map((_, row) => {
    let sum = model.bias[row]!;
    const offset = row * model.dimensions;
    for (let i = 0; i < model.dimensions; i += 1) {
      sum += model.weights[offset + i]! * vector[i]! * scale;
    }
    return sum;
  });
  const max = Math.max(...logits);
  const exps = logits.map((logit) => Math.exp(logit - max));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return model.labels
    .map((label, row) => ({ label, score: exps[row]! / total }))
    .filter((entry) => entry.label !== NO_CATEGORY_CLASS)
    .sort((a, b) => b.score - a.score);
}
