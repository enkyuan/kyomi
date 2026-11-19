import { Duration, Effect, Schedule } from "effect";
import { sql } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import { rowsFromExecute } from "@shared/db/rows";
import { logTickFailure } from "./tick";

/** Lock parent then child (same order as subscription and refresh) before checking ownership.
 * A new statement snapshot observes user-state transactions that finished before our row locks. */
export const pruneCatalogPreviews = Effect.gen(function* () {
  const db = yield* Db;
  return yield* db.use("feed.catalog.expire", (client) =>
    client.transaction(async (tx) => {
      const candidates = rowsFromExecute<{ id: string; feed_id: string }>(
        await tx.execute(sql`
      SELECT i.id,i.feed_id FROM feeds f JOIN (
        SELECT id,feed_id FROM feed_items WHERE catalog_expires_at <= NOW()
        ORDER BY catalog_expires_at,id LIMIT 500
      ) i ON f.id=i.feed_id ORDER BY f.id FOR UPDATE OF f SKIP LOCKED`),
      );
      if (!candidates.length) return;
      const ids = sql.join(
        candidates.map((row) => sql`${row.id}`),
        sql`,`,
      );
      const locked = rowsFromExecute<{ id: string }>(
        await tx.execute(sql`SELECT id FROM feed_items
      WHERE id IN (${ids}) AND catalog_expires_at <= NOW() ORDER BY id FOR UPDATE SKIP LOCKED`),
      );
      if (!locked.length) return;
      const lockedIds = sql.join(
        locked.map((row) => sql`${row.id}`),
        sql`,`,
      );
      // Promote any interacted-with or subscribed preview permanently, including raced subscriptions.
      await tx.execute(sql`UPDATE feed_items i SET catalog_expires_at=NULL WHERE i.id IN (${lockedIds}) AND
      (EXISTS(SELECT FROM feeds WHERE id=i.feed_id AND subscriber_count>0)
      OR EXISTS(SELECT FROM feed_item_user_state WHERE feed_item_id=i.id)
      OR EXISTS(SELECT FROM article_reading_state WHERE feed_item_id=i.id)
      OR EXISTS(SELECT FROM article_reports WHERE feed_item_id=i.id)
      OR EXISTS(SELECT FROM article_view_events WHERE feed_item_id=i.id))`);
      await tx.execute(
        sql`DELETE FROM feed_items WHERE id IN (${lockedIds}) AND catalog_expires_at <= NOW()`,
      );
    }),
  );
});

export const catalogRetentionLoop = pruneCatalogPreviews.pipe(
  Effect.catchCause(logTickFailure("feed.catalog.expire_failed")),
  Effect.repeat(Schedule.spaced(Duration.minutes(1))),
);
