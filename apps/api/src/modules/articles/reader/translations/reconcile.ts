import { Clock, Duration, Effect, Schedule } from "effect";
import { and, eq, inArray, lt, or } from "drizzle-orm";
import { feedItemTranslations as translations } from "@kyomi/db";
import { Db } from "@adapters/db/service";
import { JobQueue } from "@adapters/queue/service";
import { AppLogger } from "@adapters/logger/service";
import { AppConfig } from "@config/env/service";

const WAKEUP_INTERVAL_MS = 60_000;

// Recover the gap between committing the request in Postgres and XADD, and expired worker
// leases. Lock a bounded batch and advance its timestamp before publishing across replicas.
export const recoverTranslations = Effect.gen(function* () {
  const db = yield* Db;
  const queue = yield* JobQueue;
  const now = new Date(yield* Clock.currentTimeMillis);
  const due = or(
    and(
      eq(translations.status, "queued"),
      lt(translations.updatedAt, new Date(now.getTime() - WAKEUP_INTERVAL_MS)),
    ),
    and(eq(translations.status, "processing"), lt(translations.leaseExpiresAt, now)),
  );
  const ids = yield* db.use("translations.recover", (client) =>
    client.transaction(async (tx) => {
      const rows = await tx
        .select({ id: translations.id })
        .from(translations)
        .where(due)
        .orderBy(translations.updatedAt)
        .limit(50)
        .for("update", { skipLocked: true });
      if (rows.length)
        await tx
          .update(translations)
          .set({ status: "queued", updatedAt: now, leaseToken: null, leaseExpiresAt: null })
          .where(
            inArray(
              translations.id,
              rows.map((row) => row.id),
            ),
          );
      return rows;
    }),
  );
  for (const row of ids)
    yield* queue.publish({ type: "article.translate", payload: { translationId: row.id } });
});

export const translationRecoveryLoop = Effect.gen(function* () {
  const config = yield* AppConfig;
  if (!config.FEATURE_ARTICLE_TRANSLATIONS) return;
  const log = yield* AppLogger;
  yield* recoverTranslations.pipe(
    Effect.catch((error) =>
      log.error("translations.recovery.failed", { operation: error.operation }),
    ),
    Effect.repeat(Schedule.spaced(Duration.millis(WAKEUP_INTERVAL_MS))),
  );
});
