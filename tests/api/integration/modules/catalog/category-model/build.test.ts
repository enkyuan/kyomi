import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import {
  buildCategoryModel,
  CATEGORY_MODEL_LABELS,
  CATEGORY_MODEL_TRAINING_OPTIONS,
  loadTrainingLabels,
} from "@modules/catalog/category-model/build";
import { fakeEmbeddings, recordingDb } from "../fakes";

const INPUT = {
  config: { apiKey: "test-key", apiUrl: "https://fake-embeddings.test/embed" },
  labels: CATEGORY_MODEL_LABELS,
  version: "test-head",
  options: CATEGORY_MODEL_TRAINING_OPTIONS,
};

// Both refusals happen before the build writes the worker's weights module, so these run safely
// against the committed training labels.
describe("buildCategoryModel", () => {
  test("refuses to train when labeled articles are missing from the database", async () => {
    const error = await Effect.runPromise(
      Effect.flip(buildCategoryModel(INPUT)).pipe(
        Effect.provide(Layer.mergeAll(recordingDb().layer, fakeEmbeddings())),
      ),
    );

    expect(error._tag).toBe("TrainingDataIncomplete");
    expect(error.message).toMatch(/labeled training articles are not in this database/);
  });

  test("refuses to train when some articles fail to embed", async () => {
    const labels = await Effect.runPromise(loadTrainingLabels);
    const rows = labels.map((label) => ({
      id: label.id,
      feedId: "feed-1",
      itemTitle: "Title",
      itemSummary: null,
      itemContentText: null,
      itemUrl: null,
      feedTitle: "Feed",
      feedDescription: null,
      feedUrl: "https://example.com/feed.xml",
      feedSiteUrl: null,
    }));
    const pages = Array.from({ length: Math.ceil(rows.length / 1000) }, (_, page) =>
      rows.slice(page * 1000, (page + 1) * 1000),
    );
    const db = recordingDb(() => pages.shift() ?? []);
    const embeddings = fakeEmbeddings({ embedItems: () => Effect.succeed(new Map()) });

    const error = await Effect.runPromise(
      Effect.flip(buildCategoryModel(INPUT)).pipe(
        Effect.provide(Layer.mergeAll(db.layer, embeddings)),
      ),
    );

    expect(error._tag).toBe("TrainingDataIncomplete");
    expect(error.message).toMatch(/training articles failed to embed; retry the build/);
  });
});
