import { describe, expect, test } from "bun:test";
import { decodeCategoryModel, encodeCategoryModel, scoreWithCategoryModel } from "@kyomi/worker";
import { FAKE_CATEGORY_MODEL } from "./fake-category-model";

describe("category model head", () => {
  test("round-trips through its encoded form", () => {
    const decoded = decodeCategoryModel(encodeCategoryModel(FAKE_CATEGORY_MODEL));

    expect(decoded).toEqual(FAKE_CATEGORY_MODEL);
  });

  test("rejects weights that don't match its labels and dimensions", () => {
    const encoded = encodeCategoryModel(FAKE_CATEGORY_MODEL);

    expect(() => decodeCategoryModel({ ...encoded, dimensions: 4 })).toThrow(/malformed weights/);
  });

  test("scores normalized vectors, best first, without the abstain class", () => {
    const short = scoreWithCategoryModel(FAKE_CATEGORY_MODEL, [1, 0, 0]);
    const long = scoreWithCategoryModel(FAKE_CATEGORY_MODEL, [10, 0, 0]);

    expect(short.map((entry) => entry.label)).toEqual(["Software Engineering", "Technology"]);
    expect(short[0]?.score).toBeCloseTo(long[0]?.score ?? 0, 6);
    expect(short[0]?.score).toBeGreaterThan(0.99);
  });

  test("leaves every category unlikely when the abstain class wins", () => {
    const scores = scoreWithCategoryModel(FAKE_CATEGORY_MODEL, [0, 0, 1]);

    expect(scores.every((entry) => entry.score < 0.01)).toBe(true);
  });

  test("refuses vectors from another embedding size", () => {
    expect(() => scoreWithCategoryModel(FAKE_CATEGORY_MODEL, [1, 0])).toThrow(/3-dimensional/);
  });
});
