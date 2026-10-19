import { describe, expect, test } from "bun:test";
import { scoreWithCategoryModel } from "@kyomi/worker";
import {
  crossValidateCategoryModel,
  trainCategoryModel,
  type CrossValidationExample,
} from "@modules/catalog/category-model/train";

const LABELS = ["Sports", "Food & Travel", "none"];
const OPTIONS = { epochs: 200, learningRate: 0.1, l2: 1e-4, balanceClasses: true };

/** Three noisy clusters on separate axes, spread over several feeds. */
function examples(count: number): CrossValidationExample[] {
  return Array.from({ length: count }, (_, index) => {
    const label = LABELS[index % 3]!;
    const vector = [0.1, 0.1, 0.1].map((noise, axis) =>
      axis === index % 3 ? 1 : ((index * 7 + axis * 3) % 5) * noise * 0.2,
    );
    return {
      vector,
      label,
      feedId: `feed-${index % 10}`,
      expected: label === "none" ? [] : [label],
      needsReview: index % 4 === 0,
    };
  });
}

describe("trainCategoryModel", () => {
  test("learns separable categories and the abstain class", () => {
    const model = trainCategoryModel(examples(60), LABELS, "test-head", OPTIONS);

    expect(model.version).toBe("test-head");
    expect(model.weights).toHaveLength(LABELS.length * 3);
    expect(scoreWithCategoryModel(model, [1, 0.05, 0])[0]?.label).toBe("Sports");
    expect(scoreWithCategoryModel(model, [0, 1, 0.05])[0]?.label).toBe("Food & Travel");
    expect(scoreWithCategoryModel(model, [0.05, 0, 1])[0]?.score).toBeLessThan(0.2);
  });

  test("rejects labels the model doesn't know", () => {
    expect(() =>
      trainCategoryModel([{ vector: [1, 0, 0], label: "Politics" }], LABELS, "test-head", OPTIONS),
    ).toThrow(/not one of the model labels/);
  });
});

describe("crossValidateCategoryModel", () => {
  test("scores held-out feeds and ranks selection rules by F1", () => {
    const report = crossValidateCategoryModel(examples(60), LABELS, OPTIONS);

    expect(report.top1).toBeGreaterThan(0.9);
    expect(report.clearTop1).toBeGreaterThan(0.9);
    for (let index = 1; index < report.rules.length; index += 1) {
      expect(report.rules[index - 1]!.f1).toBeGreaterThanOrEqual(report.rules[index]!.f1);
    }
  });
});
