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

const csvFromEnv = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  },
  z.array(z.string().min(1)),
);

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

/** A feature flag and the credentials it requires only when the flag is enabled. */
type FeatureCredentialRule = {
  flag: string;
  credentials: readonly string[];
};

const FEATURE_CREDENTIAL_RULES: readonly FeatureCredentialRule[] = [
  { flag: "FEATURE_GOOGLE_OAUTH", credentials: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  { flag: "FEATURE_SOURCE_YOUTUBE", credentials: ["YOUTUBE_API_KEY"] },
  { flag: "FEATURE_SOURCE_REDDIT", credentials: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"] },
  { flag: "FEATURE_SOURCE_X", credentials: ["X_CLIENT_ID", "X_CLIENT_SECRET"] },
  { flag: "FEATURE_AI_ARTICLE_INTELLIGENCE", credentials: ["AI_PROVIDER", "AI_API_KEY"] },
];

/**
 * Returns the credential keys that are missing given the enabled feature flags. A credential
 * is only required when its owning flag is enabled; disabled flags never require credentials.
 */
export function findMissingFeatureCredentials(
  value: Record<string, unknown>,
): { flag: string; key: string }[] {
  const missing: { flag: string; key: string }[] = [];
  for (const rule of FEATURE_CREDENTIAL_RULES) {
    if (value[rule.flag] !== true) {
      continue;
    }
    for (const key of rule.credentials) {
      const credential = value[key];
      if (credential == null || credential === "") {
        missing.push({ flag: rule.flag, key });
      }
    }
  }
  return missing;
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
    GLOBAL_FEED_REFRESH_ENABLED: booleanFromEnv.default(nodeEnv !== "production"),
    SUBSCRIBED_FEED_REFRESH_BATCH_SIZE: z.coerce.number().int().positive().max(5_000).default(50),
    GLOBAL_FEED_REFRESH_BATCH_SIZE: z.coerce.number().int().min(0).max(1_000).default(10),
    GLOBAL_FEED_REFRESH_MAX_QUEUED: z.coerce.number().int().positive().max(1_000_000).default(25),
    FEED_REFRESH_QUEUED_LEASE_MS: z.coerce
      .number()
      .int()
      .min(60_000)
      .max(86_400_000)
      .default(900_000),
    FEED_REFRESH_RUNNING_LEASE_MS: z.coerce
      .number()
      .int()
      .min(60_000)
      .max(86_400_000)
      .default(1_800_000),
    JOB_PROCESS_CONCURRENCY: z.coerce.number().int().positive().max(64).default(4),
    JOB_READ_COUNT: z.coerce.number().int().positive().max(256).default(10),
    JOB_STREAM_MAX_LENGTH: z.coerce.number().int().min(1_000).max(5_000_000).default(100_000),
    JOB_STREAMS: csvFromEnv.default(["jobs:feed-refresh", "jobs:opml"]),
    FEED_FETCH_HOST_LEASE_MS: z.coerce.number().int().min(1_000).max(60_000).default(5_000),
    FEED_FETCH_HOST_RETRY_DELAY_MS: z.coerce.number().int().min(10).max(5_000).default(250),
    /** Comma-separated Better Auth user ids allowed to call `PUT|DELETE /feeds/:feedId/admin`. */
    FEED_ADMIN_USER_IDS: z.string().optional(),
    /** Shared secret accepted in `x-feed-admin-secret` as a backup admin control plane. */
    FEED_ADMIN_SHARED_SECRET: z.string().min(1).optional(),
    /**
     * Voyage AI API key for the embedding-based article classifier. Leave unset to run feed
     * refresh with only the deterministic keyword classifier — no FEATURE_* flag gates this,
     * matching the MEILI_* pattern of "absent means fall back," not "absent means error."
     */
    VOYAGE_API_KEY: z.string().min(1).optional(),

    // Platform-expansion feature flags. All default false; a flag's credentials are only
    // required when it is enabled (see createFinalSchema below).
    FEATURE_GOOGLE_OAUTH: booleanFromEnv.default(false),
    FEATURE_ONBOARDING: booleanFromEnv.default(false),
    FEATURE_SOURCE_YOUTUBE: booleanFromEnv.default(false),
    FEATURE_SOURCE_REDDIT: booleanFromEnv.default(false),
    FEATURE_SOURCE_X: booleanFromEnv.default(false),
    FEATURE_AI_ARTICLE_INTELLIGENCE: booleanFromEnv.default(false),
    FEATURE_SOCIAL_MODE: booleanFromEnv.default(false),
    FEATURE_LINK_PREVIEWS: booleanFromEnv.default(false),
    FEATURE_SHARE_PREVIEWS: booleanFromEnv.default(false),
    FEATURE_PUBLIC_API: booleanFromEnv.default(false),
    FEATURE_SELF_HOSTING_SETUP: booleanFromEnv.default(false),

    // Public developer API settings.
    PUBLIC_API_KEY_PREFIX: z.string().min(1).default("kyomi_pk_"),
    PUBLIC_API_DEFAULT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
    PUBLIC_API_DEFAULT_RATE_LIMIT_PER_DAY: z.coerce.number().int().positive().default(10_000),

    // Optional external credentials, gated by their matching FEATURE_* flag.
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    YOUTUBE_API_KEY: z.string().min(1).optional(),
    REDDIT_CLIENT_ID: z.string().min(1).optional(),
    REDDIT_CLIENT_SECRET: z.string().min(1).optional(),
    X_CLIENT_ID: z.string().min(1).optional(),
    X_CLIENT_SECRET: z.string().min(1).optional(),
    AI_PROVIDER: z.string().min(1).optional(),
    AI_API_KEY: z.string().min(1).optional(),
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
    GLOBAL_FEED_REFRESH_ENABLED: process.env.GLOBAL_FEED_REFRESH_ENABLED,
    SUBSCRIBED_FEED_REFRESH_BATCH_SIZE: process.env.SUBSCRIBED_FEED_REFRESH_BATCH_SIZE,
    GLOBAL_FEED_REFRESH_BATCH_SIZE: process.env.GLOBAL_FEED_REFRESH_BATCH_SIZE,
    GLOBAL_FEED_REFRESH_MAX_QUEUED: process.env.GLOBAL_FEED_REFRESH_MAX_QUEUED,
    FEED_REFRESH_QUEUED_LEASE_MS: process.env.FEED_REFRESH_QUEUED_LEASE_MS,
    FEED_REFRESH_RUNNING_LEASE_MS: process.env.FEED_REFRESH_RUNNING_LEASE_MS,
    JOB_PROCESS_CONCURRENCY: process.env.JOB_PROCESS_CONCURRENCY,
    JOB_READ_COUNT: process.env.JOB_READ_COUNT,
    JOB_STREAM_MAX_LENGTH: process.env.JOB_STREAM_MAX_LENGTH,
    JOB_STREAMS: process.env.JOB_STREAMS,
    FEED_FETCH_HOST_LEASE_MS: process.env.FEED_FETCH_HOST_LEASE_MS,
    FEED_FETCH_HOST_RETRY_DELAY_MS: process.env.FEED_FETCH_HOST_RETRY_DELAY_MS,
    FEED_ADMIN_USER_IDS: process.env.FEED_ADMIN_USER_IDS,
    FEED_ADMIN_SHARED_SECRET: process.env.FEED_ADMIN_SHARED_SECRET,
    VOYAGE_API_KEY: process.env.VOYAGE_API_KEY,
    FEATURE_GOOGLE_OAUTH: process.env.FEATURE_GOOGLE_OAUTH,
    FEATURE_ONBOARDING: process.env.FEATURE_ONBOARDING,
    FEATURE_SOURCE_YOUTUBE: process.env.FEATURE_SOURCE_YOUTUBE,
    FEATURE_SOURCE_REDDIT: process.env.FEATURE_SOURCE_REDDIT,
    FEATURE_SOURCE_X: process.env.FEATURE_SOURCE_X,
    FEATURE_AI_ARTICLE_INTELLIGENCE: process.env.FEATURE_AI_ARTICLE_INTELLIGENCE,
    FEATURE_SOCIAL_MODE: process.env.FEATURE_SOCIAL_MODE,
    FEATURE_LINK_PREVIEWS: process.env.FEATURE_LINK_PREVIEWS,
    FEATURE_SHARE_PREVIEWS: process.env.FEATURE_SHARE_PREVIEWS,
    FEATURE_PUBLIC_API: process.env.FEATURE_PUBLIC_API,
    FEATURE_SELF_HOSTING_SETUP: process.env.FEATURE_SELF_HOSTING_SETUP,
    PUBLIC_API_KEY_PREFIX: process.env.PUBLIC_API_KEY_PREFIX,
    PUBLIC_API_DEFAULT_RATE_LIMIT_PER_MINUTE: process.env.PUBLIC_API_DEFAULT_RATE_LIMIT_PER_MINUTE,
    PUBLIC_API_DEFAULT_RATE_LIMIT_PER_DAY: process.env.PUBLIC_API_DEFAULT_RATE_LIMIT_PER_DAY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
    REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID,
    REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET,
    X_CLIENT_ID: process.env.X_CLIENT_ID,
    X_CLIENT_SECRET: process.env.X_CLIENT_SECRET,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_API_KEY: process.env.AI_API_KEY,
  },
  emptyStringAsUndefined: true,
  createFinalSchema: (shape) =>
    z.object(shape).superRefine((value, ctx) => {
      for (const { flag, key } of findMissingFeatureCredentials(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} is required when ${flag} is enabled`,
        });
      }
    }),
  skipValidation: skipEnvValidation,
  onValidationError: (issues) => {
    console.error("Invalid environment variables:", issues);
    throw new Error("Invalid environment variables");
  },
});
