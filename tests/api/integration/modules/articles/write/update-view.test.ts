import { describe, expect, mock, test } from "bun:test";
import { Effect } from "effect";
import { recordArticleViewForUser } from "@modules/articles/write/update";
import { fakeDb } from "@api-tests/support/layers";

type Step = { kind: "update" | "insert"; table?: unknown; values?: unknown; result?: unknown[] };

/**
 * Plays back the statements `recordArticleViewForUser` issues, in order: `selectRows` answers the
 * feed-item lookup, `results` the `returning()` of each insert/update that has one.
 */
function viewDb(options: { feedItem?: Record<string, unknown>; results: unknown[][] }) {
  const log: Step[] = [];
  let next = 0;
  const returningOrAwait = (step: Step) => {
    const result = options.results[next++] ?? [];
    step.result = result;
    log.push(step);
    const promise = Promise.resolve(result);
    return Object.assign(promise, { returning: () => promise });
  };
  const db = {
    update: () => ({
      set: (values: unknown) => ({
        where: () => returningOrAwait({ kind: "update", values }),
      }),
    }),
    insert: () => ({
      values: (values: unknown) => {
        const done = returningOrAwait({ kind: "insert", values });
        return Object.assign(done, {
          onConflictDoNothing: () => done,
          onConflictDoUpdate: () => done,
        });
      },
    }),
    select: () => {
      const chain: Record<string, unknown> = {};
      for (const step of ["from", "where"]) {
        chain[step] = () => chain;
      }
      chain.limit = () => Promise.resolve(options.feedItem ? [options.feedItem] : []);
      return chain;
    },
  };
  return { log, layer: fakeDb(db as never) };
}

const FEED_ITEM = { id: "item_1", feedId: "feed_1", link: "https://e.com", title: "T" };

describe("recordArticleViewForUser", () => {
  test("a view of the user's clip touches the clip and records a non-first view event", async () => {
    const db = viewDb({ results: [[{ id: "clip_1" }], []] });

    await Effect.runPromise(
      recordArticleViewForUser("user-1", "clip_1").pipe(Effect.provide(db.layer)),
    );

    expect(db.log.map((step) => step.kind)).toEqual(["update", "insert"]);
    expect(db.log[1]!.values).toMatchObject({
      clipId: "clip_1",
      articleType: "clip",
      isFirstView: false,
    });
  });

  test("the first view of a feed item creates its state and increments the feed counter", async () => {
    const db = viewDb({
      feedItem: FEED_ITEM,
      results: [[], [{ feedItemId: "item_1" }], [], []],
    });

    await Effect.runPromise(
      recordArticleViewForUser("user-1", "item_1").pipe(Effect.provide(db.layer)),
    );

    expect(db.log.map((step) => step.kind)).toEqual(["update", "insert", "insert", "insert"]);
    expect(db.log[2]!.values).toMatchObject({ feedItemId: "item_1", isFirstView: true });
    expect(db.log[3]!.values).toMatchObject({ feedId: "feed_1", viewedItemCount: 1 });
  });

  test("a repeat view only refreshes timestamps and never recounts", async () => {
    // state insert conflicts (no row), first-view update matches nothing, then the stats touch hits.
    const db = viewDb({
      feedItem: FEED_ITEM,
      results: [[], [], [], [], [], [{ feedId: "feed_1" }]],
    });

    await Effect.runPromise(
      recordArticleViewForUser("user-1", "item_1").pipe(Effect.provide(db.layer)),
    );

    const events = db.log.filter((step) => step.kind === "insert");
    expect(events).toHaveLength(2);
    expect(events[1]!.values).toMatchObject({ articleType: "feed", isFirstView: false });
    expect(
      db.log.some(
        (step) =>
          step.kind === "insert" &&
          (step.values as { viewedItemCount?: number }).viewedItemCount === 1,
      ),
    ).toBe(false);
  });

  test("an unknown article is not found", async () => {
    const db = viewDb({ results: [[]] });

    const error = await Effect.runPromise(
      recordArticleViewForUser("user-1", "missing").pipe(Effect.provide(db.layer), Effect.flip),
    );

    expect(error).toMatchObject({ _tag: "NotFound", code: "ARTICLE_NOT_FOUND" });
    expect(mock).toBeDefined();
  });
});
