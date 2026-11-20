import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { checkSavedArticle } from "@modules/articles/read/saved";
import { fakeDb } from "@api-tests/support/layers";
import { renderWhere, selectResults } from "./fakes";

const run = <A, E>(effect: Effect.Effect<A, E, never>) => Effect.runPromise(effect);

describe("checkSavedArticle", () => {
  test("returns the matching saved clip before checking feed items", async () => {
    const db = selectResults([
      { id: "clip_1", title: "Saved clip", url: "https://example.com/article" },
    ]);

    const result = await run(
      checkSavedArticle("user_1", "https://example.com/article").pipe(Effect.provide(db.layer)),
    );

    expect(db.calls).toHaveLength(1);
    expect(result).toEqual({
      is_saved: true,
      article: {
        id: "clip_1",
        title: "Saved clip",
        url: "https://example.com/article",
        articleType: "clip",
      },
    });
  });

  test("falls back to saved feed items when no clip exists", async () => {
    const db = selectResults(
      [],
      [{ id: "feed_item_1", title: "Feed hit", url: "https://example.com/article" }],
    );

    const result = await run(
      checkSavedArticle("user_1", "https://example.com/article").pipe(Effect.provide(db.layer)),
    );

    expect(db.calls).toHaveLength(2);
    expect(db.calls[1]?.chain).toEqual([
      "from",
      "innerJoin",
      "innerJoin",
      "where",
      "orderBy",
      "limit",
    ]);
    expect(result).toEqual({
      is_saved: true,
      article: {
        id: "feed_item_1",
        title: "Feed hit",
        url: "https://example.com/article",
        articleType: "feed",
      },
    });
  });

  test("returns false when the url is not saved anywhere", async () => {
    const db = selectResults([], []);

    const result = await run(
      checkSavedArticle("user_1", "https://example.com/article").pipe(Effect.provide(db.layer)),
    );

    expect(db.calls).toHaveLength(2);
    expect(result).toEqual({ is_saved: false, article: null });
  });

  test("trims the url before matching", async () => {
    const db = selectResults([]);

    await run(
      checkSavedArticle("user_1", "  https://example.com/a  ").pipe(
        Effect.provide(db.layer),
        Effect.ignore,
      ),
    );

    expect(renderWhere(db.calls[0]).params).toContain("https://example.com/a");
  });

  test("fails a blank url with BadRequest ARTICLE_URL_REQUIRED before reading", async () => {
    const failure = await run(
      checkSavedArticle("user_1", "   ").pipe(Effect.flip, Effect.provide(fakeDb({}))),
    );

    expect(failure).toMatchObject({
      _tag: "BadRequest",
      message: "url is required",
      code: "ARTICLE_URL_REQUIRED",
    });
  });

  test("a database failure is a typed DatabaseError", async () => {
    const failure = await run(
      checkSavedArticle("user_1", "https://example.com/a").pipe(
        Effect.flip,
        Effect.provide(
          fakeDb({
            select: () => {
              throw new Error("down");
            },
          }),
        ),
      ),
    );

    expect(failure).toMatchObject({ _tag: "DatabaseError", operation: "articles.checkSaved.clip" });
  });
});
