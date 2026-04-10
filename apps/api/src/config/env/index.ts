import { createEnv } from "@t3-oss/env-core";
import z from "zod";

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off", ""].includes(normalized)) {
    return false;
  }
  return value;
}, z.boolean());

const nodeEnv =
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "production" ||
  process.env.NODE_ENV === "test"
    ? process.env.NODE_ENV
    : "development";

const skipEnvValidation = process.env.SKIP_ENV_VALIDATION === "true";
if (skipEnvValidation && nodeEnv === "production") {
  throw new Error("SKIP_ENV_VALIDATION must not be enabled in production");
}

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]),
    PORT: z.coerce.number().int().positive().default(8000),
    DATABASE_URL: z.string().min(1),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    DATABASE_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(30_000),
    DATABASE_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
    DATABASE_SSL_MODE: z.enum(["disable", "require", "no-verify"]).optional(),
    REDIS_URL: z.string().min(1),
    WEB_ORIGIN: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.string().min(1).optional(),
    BETTER_AUTH_TRUSTED_ORIGINS: z.string().min(1).optional(),
    LOG_LEVEL: z.enum(["info", "warn", "error"]).optional(),
    OPENAPI_ENABLED: booleanFromEnv.default(nodeEnv !== "production"),
    MEILI_URL: z.string().min(1).optional(),
    MEILI_MASTER_KEY: z.string().min(1).optional(),
    MEILI_INDEX_FEEDS: z.string().min(1).optional(),
    /** Comma-separated Better Auth user ids allowed to call `PUT|DELETE /feeds/:feedId/admin`. */
    FEED_ADMIN_USER_IDS: z.string().optional(),
    /** Shared secret accepted in `x-feed-admin-secret` as a backup admin control plane. */
    FEED_ADMIN_SHARED_SECRET: z.string().min(1).optional(),
  },
  runtimeEnv: {
    NODE_ENV: nodeEnv,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
    DATABASE_POOL_IDLE_TIMEOUT_MS: process.env.DATABASE_POOL_IDLE_TIMEOUT_MS,
    DATABASE_POOL_CONNECTION_TIMEOUT_MS: process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
    DATABASE_SSL_MODE: process.env.DATABASE_SSL_MODE,
    REDIS_URL:
      process.env.REDIS_URL?.trim() || (nodeEnv === "production" ? "" : "redis://localhost:6379"),
    WEB_ORIGIN:
      process.env.WEB_ORIGIN?.trim() || (nodeEnv === "production" ? "" : "http://localhost:3000"),
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    LOG_LEVEL: process.env.LOG_LEVEL,
    OPENAPI_ENABLED: process.env.OPENAPI_ENABLED ?? (nodeEnv === "production" ? "false" : "true"),
    MEILI_URL: process.env.MEILI_URL,
    MEILI_MASTER_KEY: process.env.MEILI_MASTER_KEY,
    MEILI_INDEX_FEEDS: process.env.MEILI_INDEX_FEEDS,
    FEED_ADMIN_USER_IDS: process.env.FEED_ADMIN_USER_IDS,
    FEED_ADMIN_SHARED_SECRET: process.env.FEED_ADMIN_SHARED_SECRET,
  },
  emptyStringAsUndefined: true,
  skipValidation: skipEnvValidation,
  onValidationError: (issues) => {
    console.error("Invalid environment variables:", issues);
    throw new Error("Invalid environment variables");
  },
});
