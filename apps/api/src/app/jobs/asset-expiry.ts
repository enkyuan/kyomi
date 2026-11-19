import { Duration, Effect, Schedule } from "effect";
import { sql } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import { logTickFailure } from "./tick";

/** Garage expires sha256 objects by bucket lifecycle. Metadata has a shorter origin-specific TTL. */
export const assetExpiryLoop = Effect.gen(function* () {
  const db = yield* Db;
  yield* db.use("assets.expire", (client) =>
    client.execute(sql`
    DELETE FROM image_assets WHERE source_key IN (
      SELECT source_key FROM image_assets WHERE expires_at<=now()
      ORDER BY expires_at,source_key LIMIT 1000 FOR UPDATE SKIP LOCKED
    )`),
  );
}).pipe(
  Effect.catchCause(logTickFailure("assets.expire_failed")),
  Effect.repeat(Schedule.spaced(Duration.minutes(1))),
);
