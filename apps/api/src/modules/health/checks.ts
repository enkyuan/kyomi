import { Clock, Effect } from "effect";
import { sql } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { API_PACKAGE_VERSION } from "@config/version";
import { SERVICE_NAME } from "@config/constants";
import { serializeError } from "@shared/errors/serialize";
import { HEALTH_STATUS } from "./constants";
import type { HealthPayload, ReadinessPayload } from "./types";

const nowIso = Effect.map(Clock.currentTimeMillis, (millis) => new Date(millis).toISOString());

export const getHealth: Effect.Effect<HealthPayload> = Effect.map(nowIso, (now) => ({
  status: HEALTH_STATUS,
  service: SERVICE_NAME,
  now,
  version: API_PACKAGE_VERSION,
}));

/** Ready when `select 1` succeeds. A failing check is logged and reported as not ready. */
export const checkReadiness: Effect.Effect<ReadinessPayload, never, Db | AppLogger> = Effect.gen(
  function* () {
    const db = yield* Db;
    const log = yield* AppLogger;
    const now = yield* nowIso;
    const ready = yield* db
      .use("select 1", (client) => client.execute(sql`select 1`))
      .pipe(
        Effect.as(true),
        Effect.catchTag("DatabaseError", (error) =>
          log
            .warn("health.ready.failed", { error: serializeError(error.cause) })
            .pipe(Effect.as(false)),
        ),
      );
    return { ready, service: SERVICE_NAME, now, version: API_PACKAGE_VERSION };
  },
);
