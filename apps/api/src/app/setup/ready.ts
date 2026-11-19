import { Data, Effect, Schedule } from "effect";
import { Db } from "@adapters/db/service";
import { assertDevelopmentDatabaseSchemaReady } from "@adapters/db/guard";

/** Postgres did not answer (or the development schema is behind) after every retry. */
export class DatabaseNotReady extends Data.TaggedError("DatabaseNotReady")<{
  readonly message: string;
  readonly cause: unknown;
}> {}

type ReadyOptions = {
  commandName: string;
  ensureSchema?: boolean;
  retries?: number;
  retryDelayMs?: number;
};

function setupHint(commandName: string): string {
  return [
    `Unable to connect to Postgres for \`${commandName}\`.`,
    "Expected `DATABASE_URL` from `apps/api/.env` to be reachable.",
    "If you use the local Docker stack, run `bun run setup:app` or `bun run docker:up` and wait for Postgres to become healthy.",
  ].join(" ");
}

/**
 * Operator-script preflight on the `Db` service: `select 1` (and, with `ensureSchema`, the
 * development schema check), retried on a fixed delay, then a `DatabaseNotReady` carrying the
 * setup hint.
 */
export const ensureDatabaseReady = Effect.fn("db.ready")(function* (options: ReadyOptions) {
  const { pool } = yield* Db;
  yield* Effect.tryPromise({
    try: async () => {
      await pool.query("select 1");
      if (options.ensureSchema) {
        await assertDevelopmentDatabaseSchemaReady(pool);
      }
    },
    catch: (cause) => new DatabaseNotReady({ message: setupHint(options.commandName), cause }),
  }).pipe(
    Effect.retry({
      schedule: Schedule.spaced(options.retryDelayMs ?? 1_500),
      times: options.retries ?? 4,
    }),
  );
});
