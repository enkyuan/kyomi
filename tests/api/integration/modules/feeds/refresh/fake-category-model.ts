import type { CategoryModel } from "@kyomi/worker";

/**
 * A 3-dimensional stand-in for the trained article head, for tests whose fake embeddings are
 * 3-dimensional: the x axis reads as Software Engineering, y as Technology, and z as no category.
 */
export const FAKE_CATEGORY_MODEL: CategoryModel = {
  version: "fake-head",
  labels: ["Software Engineering", "Technology", "none"],
  dimensions: 3,
  weights: Float32Array.from([8, 0, 0, 0, 8, 0, 0, 0, 8]),
  bias: [0, 0, 0],
};
