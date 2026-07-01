import { config } from "@dotenvx/dotenvx";
import { defineConfig } from "drizzle-kit";

config({
  path: [
    "../../docker/.env",
    "../../apps/api/.env",
    "../../apps/api/.env.local",
    "../../apps/web/.env.local",
    "../../apps/web/.env",
    ".env.local",
    ".env",
  ],
  quiet: true,
  ignore: ["MISSING_ENV_FILE"],
});

const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

function readExplicitDatabaseUrl(): string | undefined {
  const explicit = env.DATABASE_URL?.trim();
  return explicit || undefined;
}

function readPostgresEnv(): { user: string; password: string; database: string } {
  const user = env.POSTGRES_USER?.trim();
  const password = env.POSTGRES_PASSWORD;
  const database = env.POSTGRES_DB?.trim();
  if (!user || password === undefined || !database) {
    throw new Error(
      "Missing DATABASE_URL for Drizzle config. Set DATABASE_URL or POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB in docker/.env (or apps/api/.env).",
    );
  }
  return { user, password, database };
}

function buildPostgresDatabaseUrl(credentials: {
  user: string;
  password: string;
  database: string;
}): string {
  const port = env.POSTGRES_PORT?.trim() || "5432";
  const host = env.POSTGRES_HOST?.trim() || "localhost";
  const encodedUser = encodeURIComponent(credentials.user);
  const encodedPassword = encodeURIComponent(credentials.password);
  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${credentials.database}`;
}

function resolveDatabaseUrl(): string {
  const explicit = readExplicitDatabaseUrl();
  if (explicit) {
    return explicit;
  }
  return buildPostgresDatabaseUrl(readPostgresEnv());
}

const databaseUrl = resolveDatabaseUrl();

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
