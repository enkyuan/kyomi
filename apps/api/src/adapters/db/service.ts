import { Context, Effect, Layer } from "effect";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "@kyomi/db";
import { AppConfig } from "@config/env/service";
import { AppLogger } from "@adapters/logger/service";
import { DatabaseError } from "@shared/effect/errors";
import { serializeError } from "@shared/errors/serialize";
import { normalizeLoopbackUrl } from "@shared/net/loopback";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

export type DbShape = {
  /** The Drizzle client. Prefer `use` so failures become typed `DatabaseError`s. */
  readonly client: Database;
  readonly pool: Pool;
  /** Run a Promise-based Drizzle call, mapping any throw to `DatabaseError`. */
  readonly use: <A>(
    operation: string,
    run: (client: Database) => Promise<A>,
  ) => Effect.Effect<A, DatabaseError>;
};

/** Wrap a Drizzle client (real or a test fake) in the service shape. */
export function dbShape(client: Database, pool: Pool): DbShape {
  return {
    client,
    pool,
    use: (operation, run) =>
      Effect.tryPromise({
        try: () => run(client),
        catch: (cause) => new DatabaseError({ operation, cause }),
      }),
  };
}

function sslConfig(mode: "disable" | "require" | "no-verify" | undefined): PoolConfig["ssl"] {
  if (mode === "require") {
    return { rejectUnauthorized: true };
  }
  if (mode === "no-verify") {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

export function makeDb(pool: Pool): DbShape {
  return dbShape(drizzle(pool, { schema }), pool);
}

/** Postgres through Drizzle. The pool is owned by the layer's scope and ended on release. */
export class Db extends Context.Service<Db, DbShape>()("kyomi/Db") {
  static readonly layer = Layer.effect(
    Db,
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const log = yield* AppLogger;
      const pool = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const created = new Pool({
            connectionString: normalizeLoopbackUrl(config.DATABASE_URL),
            max: config.DATABASE_POOL_MAX,
            idleTimeoutMillis: config.DATABASE_POOL_IDLE_TIMEOUT_MS,
            connectionTimeoutMillis: config.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
            allowExitOnIdle: config.NODE_ENV !== "production",
            ssl: sslConfig(config.DATABASE_SSL_MODE),
          });
          // An unhandled 'error' on an idle client would otherwise crash the process.
          created.on("error", (error) => {
            Effect.runSync(log.error("db.pool.error", { error: serializeError(error) }));
          });
          return created;
        }),
        (created) =>
          Effect.tryPromise({ try: () => created.end(), catch: (cause) => cause }).pipe(
            Effect.catch((error) =>
              log.warn("lifecycle.pool.end.failed", { error: serializeError(error) }),
            ),
          ),
      );
      return Db.of(makeDb(pool));
    }),
  );
}
