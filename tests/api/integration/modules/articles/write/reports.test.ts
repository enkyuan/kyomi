import { describe, expect, mock, test } from "bun:test";
import { Effect } from "effect";
import { createBrokenArticleReport } from "@modules/articles/write/reports";
import { fakeDb } from "@api-tests/support/layers";

/** `select` answers the clip lookup first, then the feed-item lookup. */
function reportingDb(lookups: unknown[][]) {
  const values = mock(() => Promise.resolve());
  let call = 0;
  const select = () => {
    const rows = lookups[call++] ?? [];
    const chain: Record<string, unknown> = {};
    for (const step of ["from", "where", "innerJoin"]) {
      chain[step] = () => chain;
    }
    chain.limit = () => Promise.resolve(rows);
    return chain;
  };
  return { values, layer: fakeDb({ select, insert: () => ({ values }) }) };
}

const run = <A, E>(effect: Effect.Effect<A, E, never>) => Effect.runPromise(effect);

describe("createBrokenArticleReport", () => {
  test("reports one of the user's own clips with the default reason", async () => {
    const db = reportingDb([[{ id: "clip_1", title: "Clip", url: "https://example.com/c" }]]);

    await run(createBrokenArticleReport("user-1", "clip_1", {}).pipe(Effect.provide(db.layer)));

    expect(db.values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        articleType: "clip",
        clipId: "clip_1",
        reason: "broken_article",
        details: null,
        articleTitle: "Clip",
        feedTitle: null,
      }),
    );
  });

  test("reports a subscribed feed article and trims and caps the details", async () => {
    const db = reportingDb([
      [],
      [{ id: "item_1", title: "Post", url: "https://e.com/p", feedTitle: "Feed", feedUrl: "u" }],
    ]);

    await run(
      createBrokenArticleReport("user-1", "item_1", {
        reason: "wrong_content",
        details: ` ${"x".repeat(5000)} `,
      }).pipe(Effect.provide(db.layer)),
    );

    const [row] = db.values.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(row).toMatchObject({
      articleType: "feed",
      feedItemId: "item_1",
      reason: "wrong_content",
      feedTitle: "Feed",
    });
    expect((row.details as string).length).toBe(4000);
  });

  test("an article that is neither the user's clip nor in a subscribed feed is not found", async () => {
    const db = reportingDb([[], []]);

    const error = await run(
      createBrokenArticleReport("user-1", "item_9", {}).pipe(Effect.provide(db.layer), Effect.flip),
    );

    expect(error).toMatchObject({ _tag: "NotFound", code: "ARTICLE_NOT_FOUND" });
    expect(db.values).not.toHaveBeenCalled();
  });
});
