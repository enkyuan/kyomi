import { feeds, feedSubscriptions } from "@vols.rss/db";
import { and, eq } from "drizzle-orm";
import type { db } from "@adapters/db/client";

type DB = typeof db;

export { enqueueBatchFeedRefresh, enqueueFeedRefresh } from "./enqueue";

export async function listRefreshableFeedIdsForUser(
  database: DB,
  userId: string,
  folderId?: string,
): Promise<string[]> {
  if (folderId) {
    const rows = await database
      .select({ id: feeds.id })
      .from(feedSubscriptions)
      .innerJoin(feeds, eq(feedSubscriptions.feedId, feeds.id))
      .where(and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.folderId, folderId)));
    return rows.map((r) => r.id);
  }
  const rows = await database
    .select({ id: feeds.id })
    .from(feedSubscriptions)
    .innerJoin(feeds, eq(feedSubscriptions.feedId, feeds.id))
    .where(eq(feedSubscriptions.userId, userId));
  return rows.map((r) => r.id);
}
