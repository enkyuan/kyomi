import { feedItemUserState, feedItems, feedSubscriptions } from "@cronos/db";
import { sql } from "drizzle-orm";

/** SQL expression: whether the item is read for the joined subscription + optional user state row. */
export const articleIsReadSql = sql<boolean>`CASE
  WHEN ${feedItemUserState.readOverride} IS NOT NULL THEN ${feedItemUserState.readOverride}
  WHEN ${feedSubscriptions.lastReadCutoff} IS NOT NULL AND ${feedItems.publishedAt} <= ${feedSubscriptions.lastReadCutoff} THEN true
  ELSE false
END`;
