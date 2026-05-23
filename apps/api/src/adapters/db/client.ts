import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "@vols.rss/db";
import { env } from "@config/env";
import { normalizeLoopbackUrl } from "@shared/net/loopback-url";

declare global {
  var __volsRssApiDbPool: Pool | undefined;
  var __volsRssApiDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

export const pool =
  globalThis.__volsRssApiDbPool ??
  new Pool({
    connectionString: normalizeLoopbackUrl(env.DATABASE_URL),
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: env.DATABASE_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
    allowExitOnIdle: env.NODE_ENV !== "production",
    ssl: resolveSslConfig(),
  });

export const db =
  globalThis.__volsRssApiDb ??
  drizzle(pool, {
    schema,
  });

if (env.NODE_ENV !== "production") {
  globalThis.__volsRssApiDbPool = pool;
  globalThis.__volsRssApiDb = db;
}

function resolveSslConfig(): PoolConfig["ssl"] | undefined {
  if (env.DATABASE_SSL_MODE === "require") {
    return { rejectUnauthorized: true };
  }
  if (env.DATABASE_SSL_MODE === "no-verify") {
    return { rejectUnauthorized: false };
  }
  return undefined;
}
