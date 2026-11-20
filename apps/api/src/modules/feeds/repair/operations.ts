import { Clock, Effect } from "effect";
import { feedItems, feeds } from "@kyomi/db";
import { asc, eq, gt } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import type { DatabaseError } from "@shared/effect/errors";
import { planFeedItemRepair, planFeedRepair, type UnsafeFeedUrl } from "./urls";

export type UrlRepairOptions = {
  /** Without it the run reads and counts but writes nothing. */
  apply: boolean;
  batchSize: number;
  sleepMs: number;
};

export type UrlRepairReport = {
  apply: boolean;
  /** Counts are rows written, or with `apply` false rows that would be, per rule. */
  feeds: { scanned: number; faviconsCleared: number; linkColumnsCleared: number };
  feedItems: {
    scanned: number;
    linksRepaired: number;
    linksUnrepairable: number;
    imagesCleared: number;
  };
  /** Feeds whose own `url` carries a login or is not http(s): reported for an operator, never rewritten. */
  unsafeFeedUrls: ({ feedId: string } & UnsafeFeedUrl)[];
  /** Feeds written: the search index holds each one's link and icon, so these are what to re-index. */
  changedFeedIds: string[];
};

/**
 * Pages `table` by keyset on `id` (`read` takes the last id seen), calling `visit` for every row and
 * pausing `sleepMs` between pages. A short page ends the run. Every statement is bounded by
 * `batchSize`, and an interrupt (SIGINT) stops before the next one.
 */
function eachRow<Row extends { id: string }>(
  table: string,
  options: UrlRepairOptions,
  read: (after: string | null) => Effect.Effect<Row[], DatabaseError>,
  visit: (row: Row, now: Date) => Effect.Effect<void, DatabaseError>,
) {
  return Effect.gen(function* () {
    const log = yield* AppLogger;
    let after: string | null = null;
    let scanned = 0;
    while (true) {
      const rows: Row[] = yield* read(after);
      const now = new Date(yield* Clock.currentTimeMillis);
      for (const row of rows) {
        yield* visit(row, now);
      }
      scanned += rows.length;
      after = rows.at(-1)?.id ?? after;
      yield* log.info("feeds.repair.urls.batch", { table, scanned, lastId: after });
      if (rows.length < options.batchSize) {
        return;
      }
      yield* Effect.sleep(options.sleepMs);
    }
  });
}

/**
 * One-off repair of stored URLs that earlier ingestion let in (the upsert never overwrites a
 * non-empty link or image). Every row is read in keyset batches and judged in code by the parser's
 * own URL helper (`./urls`); SQL only pages by id and updates by id. Idempotent: a repaired row is
 * acceptable, so a second run finds nothing. Logs carry ids and counts, never a URL.
 */
export const repairStoredUrls = Effect.fn("feeds.repair.urls")(function* (
  options: UrlRepairOptions,
) {
  const db = yield* Db;
  const report: UrlRepairReport = {
    apply: options.apply,
    feeds: { scanned: 0, faviconsCleared: 0, linkColumnsCleared: 0 },
    feedItems: { scanned: 0, linksRepaired: 0, linksUnrepairable: 0, imagesCleared: 0 },
    unsafeFeedUrls: [],
    changedFeedIds: [],
  };

  yield* eachRow(
    "feeds",
    options,
    (after) =>
      db.use("feeds.repair.urls.read_feeds", (client) =>
        client
          .select({
            id: feeds.id,
            url: feeds.url,
            link: feeds.link,
            siteUrl: feeds.siteUrl,
            canonicalFeedUrl: feeds.canonicalFeedUrl,
            discoveredFromUrl: feeds.discoveredFromUrl,
            faviconUrl: feeds.faviconUrl,
          })
          .from(feeds)
          .where(after ? gt(feeds.id, after) : undefined)
          .orderBy(asc(feeds.id))
          .limit(options.batchSize),
      ),
    (row, now) =>
      Effect.gen(function* () {
        report.feeds.scanned += 1;
        const plan = planFeedRepair(row);
        if (plan.unsafeUrl) {
          report.unsafeFeedUrls.push({ feedId: row.id, ...plan.unsafeUrl });
        }
        if (Object.keys(plan.patch).length === 0) {
          return;
        }
        report.feeds.faviconsCleared += plan.faviconCleared ? 1 : 0;
        report.feeds.linkColumnsCleared += plan.linksCleared ? 1 : 0;
        report.changedFeedIds.push(row.id);
        if (options.apply) {
          yield* db.use("feeds.repair.urls.write_feed", (client) =>
            client
              .update(feeds)
              .set({ ...plan.patch, updatedAt: now })
              .where(eq(feeds.id, row.id)),
          );
        }
      }),
  );

  yield* eachRow(
    "feed_items",
    options,
    (after) =>
      db.use("feeds.repair.urls.read_items", (client) =>
        client
          .select({
            id: feedItems.id,
            link: feedItems.link,
            imageUrl: feedItems.imageUrl,
            feedUrl: feeds.url,
            feedLink: feeds.link,
          })
          .from(feedItems)
          .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
          .where(after ? gt(feedItems.id, after) : undefined)
          .orderBy(asc(feedItems.id))
          .limit(options.batchSize),
      ),
    (row, now) =>
      Effect.gen(function* () {
        report.feedItems.scanned += 1;
        const plan = planFeedItemRepair(row);
        report.feedItems.linksUnrepairable += plan.linkUnrepairable ? 1 : 0;
        if (Object.keys(plan.patch).length === 0) {
          return;
        }
        report.feedItems.linksRepaired += "link" in plan.patch ? 1 : 0;
        report.feedItems.imagesCleared += "imageUrl" in plan.patch ? 1 : 0;
        if (options.apply) {
          yield* db.use("feeds.repair.urls.write_item", (client) =>
            client
              .update(feedItems)
              .set({ ...plan.patch, updatedAt: now })
              .where(eq(feedItems.id, row.id)),
          );
        }
      }),
  );

  return report;
});

/** The operator summary: counts per rule, then the feed ids to act on. Ids and hosts only, no URL. */
export function formatUrlRepairReport(report: UrlRepairReport): string[] {
  const verb = report.apply ? "changed" : "would change";
  const lines = [
    report.apply ? "APPLIED" : "DRY RUN: nothing was written; pass --apply to write",
    `feeds: scanned ${report.feeds.scanned}`,
    `  favicon_url and favicon_source cleared (${verb}): ${report.feeds.faviconsCleared}`,
    `  link, site_url, canonical_feed_url, discovered_from_url cleared (${verb}): ${report.feeds.linkColumnsCleared}`,
    `feed items: scanned ${report.feedItems.scanned}`,
    `  link set to the feed's link or URL (${verb}): ${report.feedItems.linksRepaired}`,
    `  link left in place, the feed has no usable link or URL: ${report.feedItems.linksUnrepairable}`,
    `  image_url cleared (${verb}): ${report.feedItems.imagesCleared}`,
    `feeds whose own url carries a login or is not http(s), not rewritten (merge or remove): ${report.unsafeFeedUrls.length}`,
    ...report.unsafeFeedUrls.map(
      (feed) => `  feed ${feed.feedId} reason ${feed.reason} host ${feed.host ?? "-"}`,
    ),
    `feeds ${verb} (re-index these in Meilisearch, which holds each feed's link and icon): ${report.changedFeedIds.length}`,
    ...report.changedFeedIds.map((id) => `  ${id}`),
  ];
  return lines;
}
