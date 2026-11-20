import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import {
  countFeedArticlesPublishedInRange,
  countGlobalFeedArticlesPublishedInRange,
  getArticleCounts,
  getGlobalArticleCounts,
  getUnreadCountsPerFeed,
} from "@modules/articles/read/counts";
import { fakeDb } from "@api-tests/support/layers";
import { renderWhere, selectResults } from "./fakes";

const count = (c: number) => [{ c }];

describe("getArticleCounts", () => {
  test("merges clip totals into all and saved when unscoped", async () => {
    // Query order: unread, all, saved (feed items), then clip saved, clip all.
    const db = selectResults(count(5), count(10), count(3), count(2), count(4));

    const result = await Effect.runPromise(
      getArticleCounts("user_1").pipe(Effect.provide(db.layer)),
    );

    expect(db.calls).toHaveLength(5);
    expect(result).toEqual({
      all: 14, // 10 feed items + 4 clips
      unread: 5,
      saved: 5, // 3 feed saved + 2 clip saved
    });
  });

  test("does not query or merge clip counts when scoped by feedId", async () => {
    const db = selectResults(count(1), count(2), count(1));

    const result = await Effect.runPromise(
      getArticleCounts("user_1", { feedId: "feed_1" }).pipe(Effect.provide(db.layer)),
    );

    expect(db.calls).toHaveLength(3);
    expect(renderWhere(db.calls[0]).params).toContain("feed_1");
    expect(result).toEqual({ all: 2, unread: 1, saved: 1 });
  });

  test("does not query or merge clip counts when scoped by folderId", async () => {
    const db = selectResults(count(4), count(8), count(2));

    const result = await Effect.runPromise(
      getArticleCounts("user_1", { folderId: "folder_1" }).pipe(Effect.provide(db.layer)),
    );

    expect(db.calls).toHaveLength(3);
    expect(renderWhere(db.calls[1]).sql).toContain("folder_id");
    expect(result).toEqual({ all: 8, unread: 4, saved: 2 });
  });

  test("only counts items published before the clock's now", async () => {
    const db = selectResults(count(0), count(0), count(0), count(0), count(0));
    const now = Date.UTC(2026, 6, 1, 12);

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(now);
        return yield* getArticleCounts("user_1");
      }).pipe(Effect.provide(db.layer), Effect.provide(TestClock.layer())),
    );

    expect(renderWhere(db.calls[1]).params).toContain(new Date(now).toISOString());
  });

  test("a database failure is a typed DatabaseError, not a thrown error", async () => {
    const layer = fakeDb({
      select: () => {
        throw new Error("connection reset");
      },
    });

    const failure = await Effect.runPromise(
      getArticleCounts("user_1").pipe(Effect.flip, Effect.provide(layer)),
    );

    expect(failure).toMatchObject({ _tag: "DatabaseError", operation: "articles.counts.unread" });
  });
});

describe("getGlobalArticleCounts", () => {
  test("counts feed items without joining subscriptions or adding clip counts", async () => {
    const db = selectResults(count(3), count(9), count(2));

    const result = await Effect.runPromise(
      getGlobalArticleCounts("user_1", { folderId: "ignored" }).pipe(Effect.provide(db.layer)),
    );

    expect(db.calls).toHaveLength(3);
    for (const call of db.calls) {
      expect(call.chain).toEqual(["from", "leftJoin", "where"]);
    }
    expect(renderWhere(db.calls[0]).sql).not.toContain("folder_id");
    expect(result).toEqual({ all: 9, unread: 3, saved: 2 });
  });
});

describe("published range counts", () => {
  test("cap the upper bound at the clock's now", async () => {
    const db = selectResults(count(7));
    const now = Date.UTC(2026, 6, 1, 12);
    const after = new Date("2026-07-01T00:00:00.000Z");
    const farFuture = new Date("2027-01-01T00:00:00.000Z");

    const total = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(now);
        return yield* countFeedArticlesPublishedInRange("user_1", after, farFuture, {
          feedId: "feed_1",
        });
      }).pipe(Effect.provide(db.layer), Effect.provide(TestClock.layer())),
    );

    const { params } = renderWhere(db.calls[0]);
    expect(total).toBe(7);
    expect(params).toContain(after.toISOString());
    expect(params).toContain(new Date(now).toISOString());
    expect(params).not.toContain(farFuture.toISOString());
  });

  test("global range ignores subscriptions", async () => {
    const db = selectResults(count(2));

    const total = await Effect.runPromise(
      countGlobalFeedArticlesPublishedInRange(
        "user_1",
        new Date("2026-07-01T00:00:00.000Z"),
        new Date("2026-07-02T00:00:00.000Z"),
      ).pipe(Effect.provide(db.layer)),
    );

    expect(total).toBe(2);
    expect(db.calls[0]?.chain).toEqual(["from", "leftJoin", "where"]);
  });
});

describe("getUnreadCountsPerFeed", () => {
  test("returns an empty map without touching the database for no feeds", async () => {
    const db = selectResults();

    const result = await Effect.runPromise(
      getUnreadCountsPerFeed("user_1", []).pipe(Effect.provide(db.layer)),
    );

    expect(result).toEqual({});
    expect(db.calls).toHaveLength(0);
  });

  test("defaults feeds with no unread items to zero", async () => {
    const db = selectResults([{ feedId: "feed_1", count: 4 }]);

    const result = await Effect.runPromise(
      getUnreadCountsPerFeed("user_1", ["feed_1", "feed_2"]).pipe(Effect.provide(db.layer)),
    );

    expect(result).toEqual({ feed_1: 4, feed_2: 0 });
  });
});
