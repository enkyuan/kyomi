import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@cronos/db";
import { env } from "@config/env";

declare global {
  var __cronosApiDbPool: Pool | undefined;
  var __cronosApiDb: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

export const pool =
  globalThis.__cronosApiDbPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
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
