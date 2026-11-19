import { createEnv } from "@t3-oss/env-core";
import { isBlockedOutboundHostname } from "@kyomi/ingest/lib/outbound";
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

type RawEnv = Record<string, string | undefined>;

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * An absolute https URL, or http on localhost. Other schemes fail validation, including a
 * dotenvx `encrypted:` value that was loaded without its private key.
 */
export const httpsUrlFromEnv = z
  .url({ protocol: /^https?$/, error: "must be an http(s) URL" })
  .refine(
    (value) => {
      const url = new URL(value);
      return url.protocol === "https:" || LOCAL_HOSTNAMES.has(url.hostname);
    },
    { error: "must use https unless it points at localhost" },
  );

/** The embeddings Worker's `/embed` route. */
export const embeddingsWorkerUrlFromEnv = httpsUrlFromEnv.refine(
  (value) => new URL(value).pathname.endsWith("/embed"),
  { error: "must point at the Worker's /embed route" },
);

/**
 * A feature flag and the credentials it requires only when the flag is enabled. A string setting
 * used as the flag counts as enabled whenever it is set.
 */
type FeatureCredentialRule = {
  flag: string;
  credentials: readonly string[];
};

const FEATURE_CREDENTIAL_RULES: readonly FeatureCredentialRule[] = [
  {
    flag: "GARAGE_S3_ENDPOINT",
    credentials: ["GARAGE_S3_BUCKET", "GARAGE_S3_ACCESS_KEY", "GARAGE_S3_SECRET_KEY"],
  },
  { flag: "FEATURE_GOOGLE_OAUTH", credentials: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  { flag: "FEATURE_SOURCE_YOUTUBE", credentials: ["YOUTUBE_API_KEY"] },
  { flag: "FEATURE_SOURCE_REDDIT", credentials: ["REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET"] },
  { flag: "FEATURE_SOURCE_X", credentials: ["X_CLIENT_ID", "X_CLIENT_SECRET"] },
  { flag: "FEATURE_AI_ARTICLE_INTELLIGENCE", credentials: ["AI_PROVIDER", "AI_API_KEY"] },
  // The embeddings Worker needs its URL and token together; either alone is a mistake.
  { flag: "CLOUDFLARE_EMBEDDINGS_URL", credentials: ["CLOUDFLARE_EMBEDDINGS_TOKEN"] },
  { flag: "CLOUDFLARE_EMBEDDINGS_TOKEN", credentials: ["CLOUDFLARE_EMBEDDINGS_URL"] },
];

function isFlagEnabled(flag: unknown): boolean {
  return flag === true || (typeof flag === "string" && flag !== "");
}

/**
 * Returns the credential keys that are missing given the enabled feature flags. A credential
 * is only required when its owning flag is enabled; disabled flags never require credentials.
 */
export function findMissingFeatureCredentials(
  value: Record<string, unknown>,
): { flag: string; key: string }[] {
  const missing: { flag: string; key: string }[] = [];
  for (const rule of FEATURE_CREDENTIAL_RULES) {
    if (!isFlagEnabled(value[rule.flag])) {
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

const MIN_PRODUCTION_SECRET_LENGTH = 32;
/** A secret made of a handful of distinct characters (`aaaa…`, `1234…`) is not random. */
const MIN_PRODUCTION_SECRET_DISTINCT_CHARS = 10;

const isPublicHttpsOrigin = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !isBlockedOutboundHostname(url.hostname);
  } catch {
    return false;
  }
};

const hasWeakShape = (secret: string) =>
  new Set(secret).size < MIN_PRODUCTION_SECRET_DISTINCT_CHARS;

/**
 * Settings that must be real values in production. A development server may run on a short
 * secret and `http://localhost`; a production one signs sessions with the secret, builds cookie and
 * callback URLs from the base URL, and lets the feed admin secret open the admin routes to any
 * signed-in user who guesses it.
 */
export function findWeakProductionSettings(value: {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL?: string | undefined;
  FEED_ADMIN_SHARED_SECRET?: string | undefined;
}): Array<{ key: string; message: string }> {
  const issues: Array<{ key: string; message: string }> = [];
  if (value.BETTER_AUTH_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH) {
    issues.push({
      key: "BETTER_AUTH_SECRET",
      message: `BETTER_AUTH_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`,
    });
  }
  if (
    value.BETTER_AUTH_SECRET.length >= MIN_PRODUCTION_SECRET_LENGTH &&
    hasWeakShape(value.BETTER_AUTH_SECRET)
  ) {
    issues.push({
      key: "BETTER_AUTH_SECRET",
      message: `BETTER_AUTH_SECRET must be random: at least ${MIN_PRODUCTION_SECRET_DISTINCT_CHARS} distinct characters`,
    });
  }
  if (!value.BETTER_AUTH_URL) {
    issues.push({
      key: "BETTER_AUTH_URL",
      message: "BETTER_AUTH_URL is required in production (it would default to http://localhost)",
    });
  } else if (!isPublicHttpsOrigin(value.BETTER_AUTH_URL)) {
    issues.push({
      key: "BETTER_AUTH_URL",
      message: "BETTER_AUTH_URL must be a public https:// origin in production",
    });
  }
  if (
    value.FEED_ADMIN_SHARED_SECRET !== undefined &&
    (value.FEED_ADMIN_SHARED_SECRET.length < MIN_PRODUCTION_SECRET_LENGTH ||
      hasWeakShape(value.FEED_ADMIN_SHARED_SECRET))
  ) {
    issues.push({
      key: "FEED_ADMIN_SHARED_SECRET",
      message: `FEED_ADMIN_SHARED_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`,
    });
  }
  return issues;
}

/**
 * Validate a raw environment record against the API schema. Throws `Invalid environment variables`
 * on failure, so callers fail fast. `AppConfig.layer` calls this per runtime; the module-level
 * `env` below stays for code that has not moved to the Effect runtime yet.
 */
export function loadEnv(source: RawEnv = process.env) {
  // An unset or empty NODE_ENV is development. A value that is set and not exactly one of the
  // three (`prod`, `Production`, ` production`, `production\r` from a CRLF .env) is a mistake that
  // would start a production server with development defaults: OpenAPI docs on, localhost origins,
  // the global refresh on. It is compared as written, not trimmed, because Better Auth reads the
  // raw process environment and would disagree with a trimmed reading.
  const declaredNodeEnv = source.NODE_ENV;
  if (declaredNodeEnv && !["development", "production", "test"].includes(declaredNodeEnv)) {
    throw new Error(
      `NODE_ENV must be development, production or test (got ${JSON.stringify(declaredNodeEnv)})`,
    );
  }
  const nodeEnv = (declaredNodeEnv || "development") as "development" | "production" | "test";

  const skipEnvValidation = source.SKIP_ENV_VALIDATION === "true";
  if (skipEnvValidation && nodeEnv === "production") {
    throw new Error("SKIP_ENV_VALIDATION must not be enabled in production");
  }

  return createEnv({
    server: {
      NODE_ENV: z.enum(["development", "production", "test"]),
      PORT: z.coerce.number().int().positive().default(8000),
      /**
       * Pre-parse HTTP transport ceiling. Sized to accommodate the durable OPML plan's 32 MiB raw
       * XML route; article/content routes stay bounded by their own, much smaller field/aggregate
       * budgets in @shared/http/budget regardless of this value.
       */
      API_MAX_REQUEST_BODY_BYTES: z.coerce
        .number()
        .int()
        .min(32 * 1024 * 1024)
        .max(64 * 1024 * 1024)
        .default(40 * 1024 * 1024),
      DATABASE_URL: z.string().min(1),
      DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
      DATABASE_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(30_000),
      DATABASE_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
      DATABASE_SSL_MODE: z.enum(["disable", "require", "no-verify"]).optional(),
      /** The server cancels a statement that runs longer than this (Postgres `statement_timeout`). 0 turns it off. */
      DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(30_000),
      /**
       * Client-side backstop for a query the server never answers (a dead connection). Keep it above
       * the statement timeout so the server cancels first. 0 turns it off.
       */
      DATABASE_QUERY_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(35_000),
      REDIS_URL: z.string().min(1),
      REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
      /** A command with no reply after this long fails instead of waiting forever. 0 turns it off. */
      REDIS_COMMAND_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(5_000),
      WEB_ORIGIN: z.string().min(1),
      BETTER_AUTH_SECRET: z.string().min(1),
      BETTER_AUTH_URL: z.string().min(1).optional(),
      BETTER_AUTH_TRUSTED_ORIGINS: z.string().min(1).optional(),
      AUTH_EMAIL_FROM: z.string().min(1).optional(),
      RESEND_API_KEY: z.string().min(1).optional(),
      LOG_LEVEL: z.enum(["info", "warn", "error"]).optional(),
      OPENAPI_ENABLED: booleanFromEnv.default(nodeEnv !== "production"),
      GARAGE_S3_ENDPOINT: z.url({ protocol: /^https?$/ }).optional(),
      GARAGE_S3_BUCKET: z.string().min(1).optional(),
      GARAGE_S3_ACCESS_KEY: z.string().min(1).optional(),
      GARAGE_S3_SECRET_KEY: z.string().min(1).optional(),
      MEILI_URL: z.string().min(1).optional(),
      MEILI_MASTER_KEY: z.string().min(1).optional(),
      MEILI_INDEX_FEEDS: z.string().min(1).optional(),
      FEED_REFRESH_TICK_MS: z.coerce.number().int().min(1000).max(3600000).default(5000),
      CATALOG_REFRESH_INTERVAL_MS: z.coerce.number().int().min(60000).default(86400000),
      SUBSCRIBED_REFRESH_INTERVAL_MS: z.coerce.number().int().min(60000).default(3600000),
      GLOBAL_FEED_REFRESH_ENABLED: booleanFromEnv.default(nodeEnv !== "production"),
      SUBSCRIBED_FEED_REFRESH_BATCH_SIZE: z.coerce.number().int().positive().max(5_000).default(50),
      GLOBAL_FEED_REFRESH_BATCH_SIZE: z.coerce.number().int().min(0).max(1_000).default(64),
      GLOBAL_FEED_REFRESH_MAX_QUEUED: z.coerce
        .number()
        .int()
        .positive()
        .max(1_000_000)
        .default(128),
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
      /**
       * The whole window a worker has to stop in. The compose `stop_grace_period` for the worker
       * must be at least this; `app/jobs/shutdown.ts` splits it into drain, settle and reserve.
       */
      SHUTDOWN_BUDGET_MS: z.coerce.number().int().min(5_000).max(300_000).default(30_000),
      JOB_STREAMS: csvFromEnv.default([
        "jobs:feed-refresh",
        "jobs:opml",
        "jobs:article-extraction",
        "jobs:document-enrichment",
      ]),
      FEED_FETCH_HOST_LEASE_MS: z.coerce.number().int().min(1_000).max(60_000).default(30_000),
      FEED_FETCH_HOST_RETRY_DELAY_MS: z.coerce.number().int().min(10).max(5_000).default(250),
      /** Comma-separated Better Auth user ids allowed to call `PUT|DELETE /feeds/:feedId/admin`. */
      FEED_ADMIN_USER_IDS: z.string().optional(),
      /** Shared secret accepted in `x-feed-admin-secret` as a backup admin control plane. */
      FEED_ADMIN_SHARED_SECRET: z.string().min(1).optional(),
      /**
       * Kyomi's Cloudflare embeddings Worker (`apps/ai-gateway`): its `/embed` URL and bearer token,
       * for the embedding-based article classifier. Leave both unset to run feed refresh with only
       * the deterministic keyword classifier; no FEATURE_* flag gates this, matching the MEILI_*
       * pattern of "absent means fall back," not "absent means error."
       */
      CLOUDFLARE_EMBEDDINGS_URL: embeddingsWorkerUrlFromEnv.optional(),
      CLOUDFLARE_EMBEDDINGS_TOKEN: z.string().min(1).optional(),
      /**
       * Category read path. Embedding (the default) shows the trained head's labels for the active
       * embedding model and falls back to keyword rows wherever an article has none, so it never
       * shows less than keyword; with no embeddings provider configured it reads keyword rows only.
       * On the 345-article stored eval set the head scores F1 0.687 against keyword's 0.345.
       */
      CATEGORY_CLASSIFIER_READ_MODE: z.enum(["keyword", "embedding"]).default("embedding"),

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
      FEATURE_READER_DOCUMENT: booleanFromEnv.default(false),
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
      ...source,
      NODE_ENV: nodeEnv,
      REDIS_URL:
        source.REDIS_URL?.trim() || (nodeEnv === "production" ? "" : "redis://localhost:6379"),
      WEB_ORIGIN:
        source.WEB_ORIGIN?.trim() || (nodeEnv === "production" ? "" : "http://localhost:3000"),
      OPENAPI_ENABLED: source.OPENAPI_ENABLED ?? (nodeEnv === "production" ? "false" : "true"),
    },
    emptyStringAsUndefined: true,
    createFinalSchema: (shape) =>
      z.object(shape).superRefine((value, ctx) => {
        if (
          value.DATABASE_STATEMENT_TIMEOUT_MS > 0 &&
          value.DATABASE_QUERY_TIMEOUT_MS > 0 &&
          value.DATABASE_QUERY_TIMEOUT_MS <= value.DATABASE_STATEMENT_TIMEOUT_MS
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["DATABASE_QUERY_TIMEOUT_MS"],
            message:
              "DATABASE_QUERY_TIMEOUT_MS must be above DATABASE_STATEMENT_TIMEOUT_MS so the server cancels a slow statement before the client gives up",
          });
        }
        if (value.NODE_ENV === "production") {
          for (const issue of findWeakProductionSettings(value)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: [issue.key],
              message: issue.message,
            });
          }
        }
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
}

export type Env = ReturnType<typeof loadEnv>;
