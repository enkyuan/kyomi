import { Effect } from "effect";
import { articleClips, feedItemUserState, feedItems, feedSubscriptions } from "@kyomi/db";
import { and, eq, gte, inArray, lt, sql, type SQL } from "drizzle-orm";
import { currentDate } from "@shared/effect/clock";
import { Db, type Database } from "@adapters/db/service";
import { capPublishedBeforeAtNow } from "./list/window";
import {
  readSqlFor,
  subscriptionJoin,
  userStateJoin,
  visibleFeedItemSql,
  type FeedScope,
} from "./sql";
import type { ArticleCountScope, ArticleCountsDto } from "../types";

const countSql = sql<number>`count(*)::int`;

/** `count(*)` over feed items, joined to subscriptions only for the `subscribed` scope. */
function countFeedItems(
  client: Database,
  userId: string,
  scope: FeedScope,
  where: SQL | undefined,
) {
  const base = client.select({ c: countSql }).from(feedItems);
  return scope === "subscribed"
    ? base
        .innerJoin(feedSubscriptions, subscriptionJoin(userId))
        .leftJoin(feedItemUserState, userStateJoin(userId))
        .where(where)
    : base.leftJoin(feedItemUserState, userStateJoin(userId)).where(where);
}

/** Feed and folder filters; the folder filter only exists for subscriptions. */
function scopeFilter(feedScope: FeedScope, scope: ArticleCountScope | undefined) {
  const feedId = scope?.feedId?.trim();
  const folderId = scope?.folderId?.trim();
  return and(
    feedId ? eq(feedItems.feedId, feedId) : undefined,
    feedScope === "subscribed" && folderId ? eq(feedSubscriptions.folderId, folderId) : undefined,
  );
}

const firstCount = (rows: ReadonlyArray<{ c: number }>) => rows[0]?.c ?? 0;

const countArticles = Effect.fn("articles.counts")(function* (
  userId: string,
  feedScope: FeedScope,
  scope: ArticleCountScope | undefined,
) {
  const db = yield* Db;
  const now = yield* currentDate;
  const readSql = readSqlFor(feedScope);
  const published = and(
    visibleFeedItemSql,
    lt(feedItems.publishedAt, now),
    scopeFilter(feedScope, scope),
  );
  const count = (operation: string, where: SQL | undefined) =>
    db
      .use(`articles.counts.${operation}`, (client) =>
        countFeedItems(client, userId, feedScope, where),
      )
      .pipe(Effect.map(firstCount));

  const unread = yield* count("unread", and(sql`(${readSql}) = false`, published));
  const all = yield* count("all", published);
  const saved = yield* count("saved", and(sql`${feedItemUserState.isSaved} IS TRUE`, published));

  // Unscoped subscribed counts also include clips: `all` adds every clip, `saved` the saved ones.
  // Scoped by feed or folder, and the global scope, count feed items only.
  const unscoped = !scope?.feedId?.trim() && !scope?.folderId?.trim();
  if (feedScope === "global" || !unscoped) {
    return { all, unread, saved } satisfies ArticleCountsDto;
  }
  const clipCount = (operation: string, where: SQL) =>
    db
      .use(`articles.counts.clips.${operation}`, (client) =>
        client.select({ c: countSql }).from(articleClips).where(where),
      )
      .pipe(Effect.map(firstCount));
  const clipSaved = yield* clipCount(
    "saved",
    and(eq(articleClips.userId, userId), eq(articleClips.isSaved, true))!,
  );
  const clipAll = yield* clipCount("all", eq(articleClips.userId, userId));
  return { all: all + clipAll, unread, saved: saved + clipSaved } satisfies ArticleCountsDto;
});

/** Counts over the user's subscriptions plus (unscoped) their clips. */
export const getArticleCounts = (userId: string, scope?: ArticleCountScope) =>
  countArticles(userId, "subscribed", scope);

/** Counts over every feed item; only the feed filter of `scope` applies. */
export const getGlobalArticleCounts = (userId: string, scope?: ArticleCountScope) =>
  countArticles(userId, "global", scope);

/**
 * Counts feed articles whose `publishedAt` falls in `[publishedAfter, publishedBefore)`, matching
 * the date window of `GET /articles` with the same query params (feeds source only).
 */
const countPublishedInRange = Effect.fn("articles.counts.range")(function* (
  userId: string,
  feedScope: FeedScope,
  publishedAfter: Date,
  publishedBefore: Date,
  scope: ArticleCountScope | undefined,
) {
  const db = yield* Db;
  const now = yield* currentDate;
  const where = and(
    gte(feedItems.publishedAt, publishedAfter),
    lt(feedItems.publishedAt, capPublishedBeforeAtNow(publishedBefore, now)),
    visibleFeedItemSql,
    scopeFilter(feedScope, scope),
  );
  const rows = yield* db.use("articles.counts.range", (client) =>
    countFeedItems(client, userId, feedScope, where),
  );
  return firstCount(rows);
});

export const countFeedArticlesPublishedInRange = (
  userId: string,
  publishedAfter: Date,
  publishedBefore: Date,
  scope?: ArticleCountScope,
) => countPublishedInRange(userId, "subscribed", publishedAfter, publishedBefore, scope);

export const countGlobalFeedArticlesPublishedInRange = (
  userId: string,
  publishedAfter: Date,
  publishedBefore: Date,
  scope?: ArticleCountScope,
) => countPublishedInRange(userId, "global", publishedAfter, publishedBefore, scope);

/**
 * A map of feedId to unread article count for each supplied feed id (0 when none are unread).
 * One GROUP BY query, so it scales to many feeds without N+1 requests.
 */
export const getUnreadCountsPerFeed = Effect.fn("articles.counts.unreadPerFeed")(function* (
  userId: string,
  feedIds: string[],
) {
  if (feedIds.length === 0) {
    return {} as Record<string, number>;
  }
  const db = yield* Db;
  const now = yield* currentDate;
  const rows = yield* db.use("articles.counts.unreadPerFeed", (client) =>
    client
      .select({ feedId: feedItems.feedId, count: countSql })
      .from(feedItems)
      .innerJoin(feedSubscriptions, subscriptionJoin(userId))
      .leftJoin(feedItemUserState, userStateJoin(userId))
      .where(
        and(
          inArray(feedItems.feedId, feedIds),
          sql`(${readSqlFor("subscribed")}) = false`,
          visibleFeedItemSql,
          lt(feedItems.publishedAt, now),
        ),
      )
      .groupBy(feedItems.feedId),
  );

  const result: Record<string, number> = Object.fromEntries(feedIds.map((id) => [id, 0]));
  for (const row of rows) {
    result[row.feedId] = row.count;
  }
  return result;
});
