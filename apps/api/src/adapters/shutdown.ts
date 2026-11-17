import { Effect, Layer } from "effect";
import { pool } from "@adapters/db/client";
import { logger } from "@adapters/logger";
import { closeRedis } from "@adapters/redis";
import { serializeError } from "@shared/errors/serialize";

let closing: Promise<void> | undefined;

async function closeAdapters(): Promise<void> {
  await closeRedis();
  try {
    await pool.end();
  } catch (error) {
    logger.warn("lifecycle.pool.end.failed", { error: serializeError(error) });
  }
}

/**
 * Releases the module-level singletons (Postgres pool, Redis client) that modules which have not
 * moved to Effect still use. It is part of `AppLive`, so disposing the runtime is the one shutdown
 * path: Layer-owned resources and these close together, and nothing else calls `shutdownAdapters`.
 * Idempotent in case a second runtime is built in one process. Delete this file, with
 * `adapters/db/client.ts` and `adapters/redis/client.ts`, once the last module is converted.
 */
export function shutdownAdapters(): Promise<void> {
  closing ??= closeAdapters();
  return closing;
}

export const LegacyAdaptersLive = Layer.effectDiscard(
  Effect.addFinalizer(() => Effect.promise(shutdownAdapters)),
);
