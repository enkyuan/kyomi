import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "@cronos/db";
import { env } from "@config/env";
import { normalizeLoopbackUrl } from "@shared/net/normalize-loopback-url";

declare global {
  var __cronosApiDbPool: Pool | undefined;
  var __cronosApiDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

export const pool =
  globalThis.__cronosApiDbPool ??
  new Pool({
    connectionString: normalizeLoopbackUrl(env.DATABASE_URL),
    max: env.DATABASE_POOL_MAX,
    idleTimeoutMillis: env.DATABASE_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
    allowExitOnIdle: env.NODE_ENV !== "production",
    ssl: resolveSslConfig(),
  });

export const db =
  globalThis.__cronosApiDb ??
  drizzle(pool, {
    schema,
  });

if (env.NODE_ENV !== "production") {
  globalThis.__cronosApiDbPool = pool;
  globalThis.__cronosApiDb = db;
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
