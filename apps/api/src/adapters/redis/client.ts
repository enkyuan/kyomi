import Redis from "ioredis";
import { env } from "@config/env";
import { logger } from "@adapters/logger";

let shared: Redis | null = null;

export function getRedis(): Redis {
  if (!shared) {
    shared = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
    shared.on("error", (error) => {
      logger.error("redis.client.error", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
  return shared;
}

export async function closeRedis(): Promise<void> {
  if (!shared) {
    return;
  }
  try {
    await shared.quit();
  } catch (error) {
    logger.warn("lifecycle.redis.quit.failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    shared = null;
  }
}
