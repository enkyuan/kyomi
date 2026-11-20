import { Effect } from "effect";
import { sql } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { assertUserSubscribedToFeed } from "../subscription/mutations";
import type { MessageResponseDto } from "../types";

export const markAllArticlesReadInFeed = Effect.fn("feeds.read.mark_all")(function* (
  userId: string,
  feedId: string,
) {
  const db = yield* Db;
  const log = yield* AppLogger;
  yield* assertUserSubscribedToFeed(userId, feedId);
  yield* db.use("feeds.mark_all_read", (client) =>
    client.execute(sql`
      UPDATE feed_subscriptions AS fs
      SET last_read_cutoff = COALESCE(
        (SELECT MAX(fi.published_at) FROM feed_items fi WHERE fi.feed_id = fs.feed_id),
        NOW()
      )
      WHERE fs.user_id = ${userId} AND fs.feed_id = ${feedId}
    `),
  );
  yield* log.info("feeds.read_status.mark_all", { userId, feedId });
  return { message: "All articles marked as read" } satisfies MessageResponseDto;
});
