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
 * Release the legacy singleton resources (Postgres pool, Redis client) on shutdown. Idempotent, so
 * Elysia's un-awaited `onStop` hook and the process entrypoint can both call it. Layer-owned
 * resources are released by disposing the runtime instead.
 */
export function shutdownAdapters(): Promise<void> {
  closing ??= closeAdapters();
  return closing;
}
