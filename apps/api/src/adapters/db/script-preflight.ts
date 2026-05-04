import { pool } from "./client";
import { assertDevelopmentDatabaseSchemaReady } from "./startup-schema-guard";

type PreflightOptions = {
  commandName: string;
  ensureSchema?: boolean;
  retries?: number;
  retryDelayMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatSetupHint(commandName: string): string {
  return [
    `Unable to connect to Postgres for \`${commandName}\`.`,
    "Expected `DATABASE_URL` from `apps/api/.env` to be reachable.",
    "If you use the local Docker stack, run `bun run setup:app` or `bun run docker:up` and wait for Postgres to become healthy.",
  ].join(" ");
}

export async function assertApiDatabaseReady(options: PreflightOptions): Promise<void> {
  const retries = options.retries ?? 4;
  const retryDelayMs = options.retryDelayMs ?? 1_500;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await pool.query("select 1");

      if (options.ensureSchema) {
        await assertDevelopmentDatabaseSchemaReady();
      }

      return;
    } catch (error) {
      lastError = error;
      if (attempt === retries) {
        break;
      }
      await sleep(retryDelayMs);
    }
  }

  const setupHint = formatSetupHint(options.commandName);
  throw new Error(setupHint, {
    cause: lastError,
  });
}
