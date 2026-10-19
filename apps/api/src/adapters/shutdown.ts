import { pool } from "@adapters/db/client";
import { logger } from "@adapters/logger";
import { closeRedis } from "@adapters/redis";

/**
 * Release adapter-held resources on shutdown (Postgres pool, Redis client, etc.).
 */
export async function shutdownAdapters(): Promise<void> {
  await closeRedis();
  try {
    await pool.end();
  } catch (error) {
    logger.warn("lifecycle.pool.end.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
