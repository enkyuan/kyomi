import { createEnv } from "@t3-oss/env-core";
import z from "zod";

const nodeEnv =
  process.env.NODE_ENV === "development" ||
  process.env.NODE_ENV === "production" ||
  process.env.NODE_ENV === "test"
    ? process.env.NODE_ENV
    : "development";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "production", "test"]),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    WEB_ORIGIN: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.string().min(1).optional(),
    BETTER_AUTH_TRUSTED_ORIGINS: z.string().min(1).optional(),
    LOG_LEVEL: z.enum(["info", "warn", "error"]).optional(),
    /** Comma-separated Better Auth user ids allowed to call `PUT|DELETE /feeds/:feedId/admin`. */
    FEED_ADMIN_USER_IDS: z.string().optional(),
  },
  runtimeEnv: {
    NODE_ENV: nodeEnv,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL:
      process.env.REDIS_URL?.trim() || (nodeEnv === "production" ? "" : "redis://localhost:6379"),
    WEB_ORIGIN:
      process.env.WEB_ORIGIN?.trim() || (nodeEnv === "production" ? "" : "http://localhost:5173"),
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_TRUSTED_ORIGINS: process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    LOG_LEVEL: process.env.LOG_LEVEL,
    FEED_ADMIN_USER_IDS: process.env.FEED_ADMIN_USER_IDS,
  },
  emptyStringAsUndefined: true,
  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
  onValidationError: (issues) => {
    console.error("Invalid environment variables:", issues);
    throw new Error("Invalid environment variables");
  },
});
