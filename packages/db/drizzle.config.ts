import { config } from "dotenv";
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
});

function resolveDatabaseUrl(): string {
  const explicit = process.env.DATABASE_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const user = process.env.POSTGRES_USER?.trim();
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DB?.trim();
  if (!user || password === undefined || !database) {
    throw new Error(
      "Missing DATABASE_URL for Drizzle config. Set DATABASE_URL or POSTGRES_USER, POSTGRES_PASSWORD, and POSTGRES_DB in docker/.env (or apps/api/.env).",
    );
  }

  const port = process.env.POSTGRES_PORT?.trim() || "5432";
  const host = process.env.POSTGRES_HOST?.trim() || "localhost";
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);

  return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`;
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
