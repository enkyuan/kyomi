import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { listAllArticles, listArticles } from "@modules/articles/read/list/query";
import { decodeCompositeCursor } from "@modules/articles/read/list/cursor";
import type { ArticleListRawRow } from "@modules/articles/read/list/dedupe";
import type { Db } from "@adapters/db/service";
import { recordingLogger, testConfig } from "@api-tests/support/layers";
import { renderWhere, selectBy, selectResults } from "../fakes";

function row(overrides: Partial<ArticleListRawRow> = {}): ArticleListRawRow {
  return {
    id: "item-1",
    title: "A reasonable title",
    canonicalUrl: "https://a.example.com/1",
    link: "https://a.example.com/1",
    summary: "Summary",
    publishedAt: new Date("2026-06-01T00:00:00.000Z"),
    feedId: "feed-1",
    feedUrl: "https://a.example.com/rss",
    feedSiteUrl: "https://a.example.com",
    feedTitle: "Alpha",
    feedFaviconUrl: null,
    isRead: false,
    isSaved: false,
    lastViewedAt: null,
    hiddenAt: null,
    categories: [],
    ...overrides,
  };
}

/** Answers the list query with `rows` and the reading-progress lookup with nothing. */
const listDb = (rows: ArticleListRawRow[], cursorRows: unknown[] = []) =>
  selectBy((fields) => {
    if (fields && "canonicalUrl" in fields) {
      return rows;
    }
    return fields && "feedItemId" in fields ? [] : cursorRows;
  });

function run<A, E, R>(effect: Effect.Effect<A, E, R>, layer: Layer.Layer<R, unknown>) {
  return Effect.runPromise(effect.pipe(Effect.provide(layer)));
}

const services = (db: { layer: Layer.Layer<Db> }, logs = recordingLogger()) =>
  Layer.mergeAll(db.layer, testConfig(), logs.layer);

describe("listArticles", () => {
  test("pages: returns `limit` items, has_more, and a cursor at the last returned row", async () => {
    const rows = [
      row({
        id: "c",
        publishedAt: new Date("2026-06-03T00:00:00.000Z"),
        canonicalUrl: "u3",
        link: "u3",
      }),
      row({
        id: "b",
        publishedAt: new Date("2026-06-02T00:00:00.000Z"),
        canonicalUrl: "u2",
        link: "u2",
      }),
      row({
        id: "a",
        publishedAt: new Date("2026-06-01T00:00:00.000Z"),
        canonicalUrl: "u1",
        link: "u1",
      }),
    ];
    const db = listDb(rows);

    const page = await run(listArticles("user-1", { limit: 2 }), services(db));

    expect(page.items.map((item) => item.id)).toEqual(["c", "b"]);
    expect(page.has_more).toBe(true);
    expect(page.total_count).toBeNull();
    expect(decodeCompositeCursor(page.next_cursor!)).toMatchObject({ id: "b", isRead: false });
  });

  test("hides rows the user hid and logs when duplicates collapse", async () => {
    const logs = recordingLogger();
    const db = listDb([
      row({
        id: "hidden",
        hiddenAt: new Date("2026-06-02T00:00:00.000Z"),
        canonicalUrl: "h",
        link: "h",
      }),
      row({ id: "dup-1", canonicalUrl: "same", link: "same" }),
      row({ id: "dup-2", canonicalUrl: "same", link: "same" }),
    ]);

    const page = await run(listArticles("user-1", { limit: 10 }), services(db, logs));

    expect(page.items).toHaveLength(1);
    expect(page.has_more).toBe(false);
    expect(page.next_cursor).toBeNull();
    expect(logs.entries).toEqual([
      {
        level: "warn",
        event: "articles.list_time_dedupe.collapsed",
        context: { rawCount: 2, dedupedCount: 1, collapsedCount: 1 },
      },
    ]);
  });

  test("joins subscriptions for the subscribed list and not for the global list", async () => {
    const subscribed = listDb([]);
    const global = listDb([]);

    await run(listArticles("user-1", { limit: 5 }), services(subscribed));
    await run(listAllArticles("user-1", { limit: 5 }), services(global));

    expect(subscribed.calls[0]?.chain).toEqual([
      "from",
      "innerJoin",
      "innerJoin",
      "leftJoin",
      "where",
      "orderBy",
      "limit",
    ]);
    expect(global.calls[0]?.chain).toEqual([
      "from",
      "innerJoin",
      "leftJoin",
      "where",
      "orderBy",
      "limit",
    ]);
  });

  test("filters by feed, folder, read state, saved, search, and the date window", async () => {
    const db = listDb([]);
    const now = Date.UTC(2026, 6, 1, 12);

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(now);
        return yield* listArticles("user-1", {
          limit: 5,
          feedId: "feed-9",
          folderId: "folder-9",
          isRead: false,
          isSaved: true,
          search: "50%_off",
          publishedAfter: new Date("2026-06-01T00:00:00.000Z"),
          publishedBefore: new Date("2027-01-01T00:00:00.000Z"),
        });
      }).pipe(Effect.provide(services(db)), Effect.provide(TestClock.layer())),
    );

    const { sql, params } = renderWhere(db.calls[0]);
    expect(params).toContain("feed-9");
    expect(params).toContain("folder-9");
    expect(params).toContain("%50\\%\\_off%");
    expect(params).toContain("2026-06-01T00:00:00.000Z");
    // A future upper bound is capped at the clock's now.
    expect(params).toContain(new Date(now).toISOString());
    expect(params).not.toContain("2027-01-01T00:00:00.000Z");
    expect(sql).toContain("= false");
    expect(sql).toContain('"is_saved" IS TRUE');
  });

  test("the global list ignores a stray feed filter and reads the per-user read override", async () => {
    const db = listDb([]);

    await run(listAllArticles("user-1", { limit: 5, isRead: true }), services(db));

    const { sql } = renderWhere(db.calls[0]);
    expect(sql).toContain("COALESCE");
    expect(sql).toContain("= true");
    expect(sql).not.toContain("folder_id");
  });

  test("an a1 cursor sets the page boundary without a lookup", async () => {
    const db = listDb([]);
    const cursor = `2026-06-01T00:00:00.000Z::item-5`;

    await run(listArticles("user-1", { limit: 5, cursor }), services(db));

    // rows query only: the iso::id form is decoded in memory.
    expect(db.calls).toHaveLength(1);
    expect(renderWhere(db.calls[0]).params).toContain("item-5");
  });

  test("an article-id cursor is looked up first and a missing id starts from the first page", async () => {
    const db = listDb([], []);

    await run(listArticles("user-1", { limit: 5, cursor: "item-gone" }), services(db));

    expect(db.calls).toHaveLength(2);
    expect(db.calls[0]?.chain).toEqual(["from", "innerJoin", "leftJoin", "where", "limit"]);
    expect(renderWhere(db.calls[0]).params).toContain("item-gone");
    expect(renderWhere(db.calls[1]).params).not.toContain("item-gone");
  });

  test("a merged-view boundary replaces the cursor", async () => {
    const db = selectResults([]);

    await run(
      listArticles("user-1", {
        limit: 5,
        cursor: "ignored",
        exclusiveBefore: { publishedAt: new Date("2026-06-01T00:00:00.000Z"), id: "edge" },
      }),
      services(db),
    );

    expect(db.calls).toHaveLength(1);
    expect(renderWhere(db.calls[0]).params).toContain("edge");
    expect(renderWhere(db.calls[0]).params).not.toContain("ignored");
  });
});
