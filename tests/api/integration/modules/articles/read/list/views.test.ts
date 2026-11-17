import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import {
  listMergedRecentlyReadView,
  listMergedSavedView,
  listMergedTodayView,
} from "@modules/articles/read/list/views";
import { decodeMergedListCursor, decodeRecentViewCursor } from "@modules/articles/read/list/cursor";
import type { Db } from "@adapters/db/service";
import { recordingLogger, testConfig } from "@api-tests/support/layers";
import { renderWhere, selectBy, type SelectFields } from "../fakes";

type Rows = { list?: unknown[]; clips?: unknown[]; recentFeed?: unknown[] };

/** Routes each query to its rows by the fields it selects; reading-progress lookups are empty. */
function viewsDb(rows: Rows) {
  return selectBy((fields: SelectFields) => {
    if (fields && "note" in fields) {
      return rows.clips ?? [];
    }
    if (fields && "feedItemId" in fields) {
      return [];
    }
    if (fields && "canonicalUrl" in fields) {
      return rows.list ?? [];
    }
    return rows.recentFeed ?? [];
  });
}

const services = (db: { layer: Layer.Layer<Db> }) =>
  Layer.mergeAll(db.layer, testConfig(), recordingLogger().layer);

const feedRow = (id: string, publishedAt: string) => ({
  id,
  title: `Title ${id}`,
  canonicalUrl: `https://example.com/${id}`,
  link: `https://example.com/${id}`,
  summary: "Summary",
  publishedAt: new Date(publishedAt),
  feedId: "feed-1",
  feedUrl: "https://example.com/rss",
  feedSiteUrl: "https://example.com",
  feedTitle: "Example",
  feedFaviconUrl: null,
  isRead: false,
  isSaved: true,
  lastViewedAt: null,
  hiddenAt: null,
  categories: [],
});

describe("merged views", () => {
  test("fail with MERGED_VIEW_CURSOR_INVALID before touching the database", async () => {
    const db = viewsDb({});

    const failure = await Effect.runPromise(
      listMergedSavedView("user-1", 10, "not-a-cursor").pipe(
        Effect.flip,
        Effect.provide(services(db)),
      ),
    );

    expect(failure).toMatchObject({ _tag: "BadRequest", code: "MERGED_VIEW_CURSOR_INVALID" });
    expect(db.calls).toHaveLength(0);
  });

  test("saved view pages the merged feed and clip lists with an m1 cursor", async () => {
    const db = viewsDb({
      list: [
        feedRow("newer", "2026-06-02T00:00:00.000Z"),
        feedRow("older", "2026-06-01T00:00:00.000Z"),
      ],
    });

    const page = await Effect.runPromise(
      listMergedSavedView("user-1", 1).pipe(Effect.provide(services(db))),
    );

    expect(page.items.map((item) => item.id)).toEqual(["newer"]);
    expect(page.has_more).toBe(true);
    const boundary = await Effect.runPromise(decodeMergedListCursor(page.next_cursor!));
    expect(boundary).toMatchObject({ id: "newer", isRead: false });
    expect(boundary?.publishedAt.toISOString()).toBe("2026-06-02T00:00:00.000Z");
  });

  test("saved view asks both sources for saved items only", async () => {
    const db = viewsDb({});

    await Effect.runPromise(listMergedSavedView("user-1", 10).pipe(Effect.provide(services(db))));

    const feedCall = db.calls.find((call) => call.chain.includes("innerJoin"));
    expect(renderWhere(feedCall).sql).toContain('"is_saved" IS TRUE');
    const clipCall = db.calls.find((call) => call.chain.join() === "from,where,orderBy,limit");
    expect(renderWhere(clipCall).sql).toContain('"is_saved"');
  });

  test("today view uses the UTC day of the clock for both sources", async () => {
    const db = viewsDb({});
    const now = Date.UTC(2026, 6, 1, 23, 30);

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(now);
        return yield* listMergedTodayView("user-1", 10);
      }).pipe(Effect.provide(services(db)), Effect.provide(TestClock.layer())),
    );

    const wheres = db.calls.filter((call) => call.where).map((call) => renderWhere(call).params);
    expect(wheres.length).toBeGreaterThanOrEqual(2);
    for (const params of wheres) {
      expect(params).toContain("2026-07-01T00:00:00.000Z");
    }
    // The feed list also caps its upper bound at now, which is before the day's end.
    expect(wheres.some((params) => params.includes("2026-07-02T00:00:00.000Z"))).toBe(true);
  });
});

describe("recently-read view", () => {
  test("fails with RECENT_VIEW_CURSOR_INVALID for a merged-view cursor", async () => {
    const db = viewsDb({});
    const merged = `m1.${Buffer.from(JSON.stringify({ v: 1, pa: "2026-06-01T00:00:00.000Z", id: "a" })).toString("base64url")}`;

    const failure = await Effect.runPromise(
      listMergedRecentlyReadView("user-1", 10, merged).pipe(
        Effect.flip,
        Effect.provide(services(db)),
      ),
    );

    expect(failure).toMatchObject({ _tag: "BadRequest", code: "RECENT_VIEW_CURSOR_INVALID" });
  });

  test("merges feed and clip views by last-viewed time and pages with an rv1 cursor", async () => {
    const db = viewsDb({
      recentFeed: [
        {
          ...feedRow("feed-new", "2026-05-01T00:00:00.000Z"),
          lastViewedAt: new Date("2026-06-05T00:00:00.000Z"),
        },
        {
          ...feedRow("feed-old", "2026-05-01T00:00:00.000Z"),
          lastViewedAt: new Date("2026-06-01T00:00:00.000Z"),
        },
      ],
      clips: [
        {
          id: "clip-mid",
          title: "Clip",
          url: "https://example.com/clip",
          note: null,
          createdAt: new Date("2026-05-02T00:00:00.000Z"),
          lastViewedAt: new Date("2026-06-03T00:00:00.000Z"),
          isRead: true,
          isSaved: false,
        },
      ],
    });

    const page = await Effect.runPromise(
      listMergedRecentlyReadView("user-1", 2).pipe(Effect.provide(services(db))),
    );

    expect(page.items.map((item) => item.id)).toEqual(["feed-new", "clip-mid"]);
    expect(page.items[1]?.lastViewedAt).toBe("2026-06-03T00:00:00.000Z");
    expect(page.has_more).toBe(true);
    const boundary = await Effect.runPromise(decodeRecentViewCursor(page.next_cursor!));
    expect(boundary).toMatchObject({ id: "clip-mid", isRead: true });
  });
});
