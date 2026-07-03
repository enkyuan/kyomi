import { sql } from "drizzle-orm";
import type { db } from "@adapters/db/client";
import { assertUserSubscribedToFeed } from "../index";
import type { MessageResponseDto } from "../types";

type DB = typeof db;

export async function markAllArticlesReadInFeed(
  database: DB,
  userId: string,
  feedId: string,
): Promise<MessageResponseDto> {
  await assertUserSubscribedToFeed(database, userId, feedId);
  await database.execute(sql`
    UPDATE feed_subscriptions AS fs
    SET last_read_cutoff = COALESCE(
      (SELECT MAX(fi.published_at) FROM feed_items fi WHERE fi.feed_id = fs.feed_id),
      NOW()
    )
    WHERE fs.user_id = ${userId} AND fs.feed_id = ${feedId}
  `);
  return { message: "All articles marked as read" };
}
