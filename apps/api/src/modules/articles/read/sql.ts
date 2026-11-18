import { feedItemUserState, feedItems, feedSubscriptions } from "@kyomi/db";
import { and, eq, ilike, or, sql, type AnyColumn, type SQL } from "drizzle-orm";

/** SQL expression: whether the item is read for the joined subscription + optional user state row. */
export const articleIsReadSql = sql<boolean>`CASE
  WHEN ${feedItemUserState.readOverride} IS NOT NULL THEN ${feedItemUserState.readOverride}
  WHEN ${feedSubscriptions.lastReadCutoff} IS NOT NULL AND ${feedItems.publishedAt} <= ${feedSubscriptions.lastReadCutoff} THEN true
  ELSE false
END`;

/** SQL expression: user-specific read state when an item is not scoped to a subscription. */
export const globalArticleIsReadSql = sql<boolean>`COALESCE(${feedItemUserState.readOverride}, false)`;

/**
 * `subscribed` reads the user's subscribed feed items (feed and folder filters apply) and derives
 * read state from the subscription cutoff. `global` reads every feed item and uses only the
 * per-user read override.
 */
export type FeedScope = "subscribed" | "global";

export const readSqlFor = (scope: FeedScope) =>
  scope === "subscribed" ? articleIsReadSql : globalArticleIsReadSql;

/** Join condition of `feed_items` to the user's subscription row. */
export const subscriptionJoin = (userId: string) =>
  and(eq(feedItems.feedId, feedSubscriptions.feedId), eq(feedSubscriptions.userId, userId));

/** Join condition of `feed_items` to the user's per-item state row. */
export const userStateJoin = (userId: string) =>
  and(eq(feedItemUserState.feedItemId, feedItems.id), eq(feedItemUserState.userId, userId));

/** Items the user has not hidden. Needs `feedItemUserState` left-joined. */
export const visibleFeedItemSql = sql`${feedItemUserState.hiddenAt} IS NULL`;

/** Escapes `\`, `%` and `_` so user text matches literally inside an `ILIKE` pattern. */
export function escapeLikePattern(input: string): string {
  return input.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

/** Case-insensitive substring match of `search` against any of `columns`; undefined when blank. */
export function searchFilter(search: string | undefined, columns: AnyColumn[]): SQL | undefined {
  const trimmed = search?.trim();
  if (!trimmed) {
    return undefined;
  }
  const pattern = `%${escapeLikePattern(trimmed)}%`;
  return or(...columns.map((column) => ilike(column, pattern)));
}
