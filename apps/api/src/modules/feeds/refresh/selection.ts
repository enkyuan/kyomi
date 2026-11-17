import { Effect } from "effect";
import { feeds, feedSubscriptions } from "@kyomi/db";
import { and, eq } from "drizzle-orm";
import { Db } from "@adapters/db/service";

export const listRefreshableFeedIdsForUser = Effect.fn("feeds.refresh.list_refreshable")(function* (
  userId: string,
  folderId?: string,
) {
  const db = yield* Db;
  const rows = yield* db.use("feeds.refresh.list_refreshable", (client) =>
    client
      .select({ id: feeds.id })
      .from(feedSubscriptions)
      .innerJoin(feeds, eq(feedSubscriptions.feedId, feeds.id))
      .where(
        folderId
          ? and(eq(feedSubscriptions.userId, userId), eq(feedSubscriptions.folderId, folderId))
          : eq(feedSubscriptions.userId, userId),
      ),
  );
  return rows.map((r) => r.id);
});
