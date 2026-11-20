import { Effect } from "effect";
import { Db, type Database } from "@adapters/db/service";
import { AppConfig } from "@config/env/service";
import {
  articleClips,
  articleReadingState,
  feedItemUserState,
  feedItems,
  feedUserStats,
  feeds,
} from "@kyomi/db";
import { and, desc, eq, gte, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import type { ReadingStateRow } from "@modules/articles/progress/write";
import { categoryLabelsFor } from "@modules/articles/read/labels";
import { toArticleListItems } from "@modules/articles/read/list/query";
import { globalArticleIsReadSql } from "@modules/articles/read/sql";
import { clipReadColumns } from "@modules/articles/write/clips/columns";
import { CLIP_LIST_FEED_ID, CLIP_LIST_FEED_TITLE } from "@modules/articles/write/clips/constants";
import { RESURFACE_CONFIG } from "./schedule";
import type { ContinueReadingCandidate } from "./types";

/** A transaction handle exposes the same query builders as the database. */
type Queryable = Pick<Database, "select">;

/**
 * Upper bound on candidate rows read per article kind. The SQL pre-filter already drops everything
 * `isEligible` would, so this only bounds a pathological backlog; oldest-due rows win.
 */
export const CANDIDATE_LIMIT = 200;

/**
 * The conditions `isEligible` evaluates in TypeScript that the `(user_id, due_at)` partial index
 * and row columns can answer in SQL. `isEligible` stays the source of truth; this only keeps rows
 * it would reject out of the candidate window.
 */
function dueCandidateFilter(userId: string, now: Date): SQL {
  return and(
    eq(articleReadingState.userId, userId),
    inArray(articleReadingState.state, ["reading", "resurfacing"]),
    lte(articleReadingState.dueAt, now),
    gte(articleReadingState.maxProgress, RESURFACE_CONFIG.engagedMinProgress),
    gte(articleReadingState.activeReadMs, RESURFACE_CONFIG.engagedMinActiveMs),
    gte(articleReadingState.contentWords, RESURFACE_CONFIG.minWords),
    lte(articleReadingState.lastReadAt, new Date(now.getTime() - RESURFACE_CONFIG.minGapMs)),
  )!;
}

export const listFeedCandidates = Effect.fn("articles.resurface.listFeedCandidates")(function* (
  userId: string,
  now: Date,
) {
  const db = yield* Db;
  const categories = categoryLabelsFor(yield* AppConfig);
  const rows = yield* db.use("articles.resurface.feed_candidates", (client) =>
    client
      .select({
        reading: articleReadingState,
        id: feedItems.id,
        title: feedItems.title,
        canonicalUrl: feedItems.canonicalUrl,
        link: feedItems.link,
        summary: feedItems.summary,
        publishedAt: feedItems.publishedAt,
        feedId: feedItems.feedId,
        feedUrl: feeds.url,
        feedSiteUrl: feeds.link,
        feedTitle: feeds.title,
        feedFaviconUrl: feeds.faviconUrl,
        isRead: globalArticleIsReadSql,
        isSaved: sql<boolean>`COALESCE(${feedItemUserState.isSaved}, false)`,
        lastViewedAt: feedItemUserState.lastViewedAt,
        hiddenAt: feedItemUserState.hiddenAt,
        categories,
        viewedItemCount: feedUserStats.viewedItemCount,
      })
      .from(articleReadingState)
      .innerJoin(feedItems, eq(articleReadingState.feedItemId, feedItems.id))
      .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
      .leftJoin(
        feedItemUserState,
        and(eq(feedItemUserState.feedItemId, feedItems.id), eq(feedItemUserState.userId, userId)),
      )
      .leftJoin(
        feedUserStats,
        and(eq(feedUserStats.feedId, feedItems.feedId), eq(feedUserStats.userId, userId)),
      )
      .where(and(dueCandidateFilter(userId, now), isNull(feedItemUserState.hiddenAt)))
      .orderBy(articleReadingState.dueAt)
      .limit(CANDIDATE_LIMIT),
  );

  return rows.map(({ reading, viewedItemCount, ...row }): ContinueReadingCandidate => {
    const { readingProgress: _, ...item } = toArticleListItems([row])[0]!;
    return {
      reading,
      item,
      isHidden: row.hiddenAt !== null,
      isSaved: row.isSaved,
      feedViewedItemCount: viewedItemCount ?? 0,
    };
  });
});

export const listClipCandidates = Effect.fn("articles.resurface.listClipCandidates")(function* (
  userId: string,
  now: Date,
) {
  const db = yield* Db;
  const rows = yield* db.use("articles.resurface.clip_candidates", (client) =>
    client
      .select({ reading: articleReadingState, clip: clipReadColumns })
      .from(articleReadingState)
      .innerJoin(articleClips, eq(articleReadingState.clipId, articleClips.id))
      // The clip owner must match too, so a row can never surface another user's clip.
      .where(and(dueCandidateFilter(userId, now), eq(articleClips.userId, userId)))
      .orderBy(articleReadingState.dueAt)
      .limit(CANDIDATE_LIMIT),
  );

  return rows.map(
    ({ reading, clip }): ContinueReadingCandidate => ({
      reading,
      item: {
        id: clip.id,
        title: clip.title,
        link: clip.url,
        summary: clip.note,
        publishedAt: clip.createdAt.toISOString(),
        feedId: CLIP_LIST_FEED_ID,
        feedUrl: clip.url,
        feedSiteUrl: null,
        feedTitle: CLIP_LIST_FEED_TITLE,
        feedFaviconUrl: null,
        isRead: clip.isRead,
        isSaved: clip.isSaved,
        lastViewedAt: clip.lastViewedAt?.toISOString() ?? null,
        articleType: "clip" as const,
        categories: [],
      },
      isHidden: false,
      isSaved: clip.isSaved,
      feedViewedItemCount: null,
    }),
  );
});

/** The user's largest per-feed viewed count: the denominator of the affinity term. */
export const getMaxFeedViewedItemCount = Effect.fn("articles.resurface.maxFeedViewedItemCount")(
  function* (userId: string) {
    const db = yield* Db;
    const rows = yield* db.use("articles.resurface.max_feed_viewed_item_count", (client) =>
      client
        .select({ viewedItemCount: feedUserStats.viewedItemCount })
        .from(feedUserStats)
        .where(eq(feedUserStats.userId, userId))
        .orderBy(desc(feedUserStats.viewedItemCount))
        .limit(1),
    );
    return rows[0]?.viewedItemCount ?? 0;
  },
);

type LockedReadingRow = {
  reading: ReadingStateRow;
  isHidden: boolean;
};

/**
 * The user's own reading-state rows for the given article ids (feed item or clip), locked for the
 * rest of the transaction so concurrent impressions or dismissals apply one after another.
 * Ids that are not this user's rows simply do not match.
 *
 * Promise-based because it runs inside the callback of a Drizzle transaction, which the caller
 * wraps in `Db.use`.
 */
export async function lockReadingRows(
  database: Queryable,
  userId: string,
  articleIds: readonly string[],
): Promise<LockedReadingRow[]> {
  if (articleIds.length === 0) {
    return [];
  }
  const rows = await database
    .select({ reading: articleReadingState, hiddenAt: feedItemUserState.hiddenAt })
    .from(articleReadingState)
    .leftJoin(
      feedItemUserState,
      and(
        eq(feedItemUserState.feedItemId, articleReadingState.feedItemId),
        eq(feedItemUserState.userId, userId),
      ),
    )
    .where(
      and(
        eq(articleReadingState.userId, userId),
        or(
          inArray(articleReadingState.feedItemId, [...articleIds]),
          inArray(articleReadingState.clipId, [...articleIds]),
        ),
      ),
    )
    .for("update", { of: articleReadingState });
  return rows.map((row) => ({ reading: row.reading, isHidden: row.hiddenAt !== null }));
}
