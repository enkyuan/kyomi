import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { getArticleDetail } from "@modules/articles/read/detail";
import { testConfig } from "@api-tests/support/layers";
import { rawDetailRow, selectResults } from "./fakes";

const clipRow = {
  id: "clip-1",
  userId: "user-1",
  url: "https://example.com/clip",
  title: "Clip",
  content: null,
  contentHtml: null,
  contentText: "Body",
  contentMarkdown: null,
  contentStatus: "ready",
  contentSource: "feed_html",
  extractionErrorCode: null,
  extractionErrorMessage: null,
  extractedContentHtml: null,
  extractedContentText: null,
  extractedContentStatus: "pending",
  extractedContentError: null,
  extractedContentUpdatedAt: null,
  note: null,
  isRead: false,
  isSaved: true,
  createdAt: new Date("2026-07-04T00:00:00.000Z"),
  updatedAt: new Date("2026-07-04T00:00:00.000Z"),
};

const run = <A, E>(effect: Effect.Effect<A, E, never>) => Effect.runPromise(effect);

describe("getArticleDetail", () => {
  test("returns the feed item when it exists", async () => {
    const db = selectResults([rawDetailRow()], []);

    const detail = await run(
      getArticleDetail("user-1", "item-1").pipe(
        Effect.provide(Layer.mergeAll(db.layer, testConfig())),
      ),
    );

    expect(detail).toMatchObject({ id: "item-1", articleType: "feed" });
  });

  test("falls back to the user's clip when no feed item matches", async () => {
    const db = selectResults([], [clipRow]);

    const detail = await run(
      getArticleDetail("user-1", "clip-1").pipe(
        Effect.provide(Layer.mergeAll(db.layer, testConfig())),
      ),
    );

    expect(detail).toMatchObject({ id: "clip-1", articleType: "clip" });
  });

  test("fails NotFound ARTICLE_NOT_FOUND when neither exists", async () => {
    const db = selectResults([], []);

    const failure = await run(
      getArticleDetail("user-1", "missing").pipe(
        Effect.flip,
        Effect.provide(Layer.mergeAll(db.layer, testConfig())),
      ),
    );

    expect(failure).toMatchObject({
      _tag: "NotFound",
      message: "Article not found",
      code: "ARTICLE_NOT_FOUND",
    });
  });
});
