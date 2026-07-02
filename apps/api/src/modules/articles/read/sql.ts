import { feedItemUserState, feedItems, feedSubscriptions } from "@kyomi/db";
import { sql } from "drizzle-orm";

/** SQL expression: whether the item is read for the joined subscription + optional user state row. */
export const articleIsReadSql = sql<boolean>`CASE
  WHEN ${feedItemUserState.readOverride} IS NOT NULL THEN ${feedItemUserState.readOverride}
  WHEN ${feedSubscriptions.lastReadCutoff} IS NOT NULL AND ${feedItems.publishedAt} <= ${feedSubscriptions.lastReadCutoff} THEN true
  ELSE false
END`;

/** SQL expression: user-specific read state when an item is not scoped to a subscription. */
export const globalArticleIsReadSql = sql<boolean>`COALESCE(${feedItemUserState.readOverride}, false)`;
