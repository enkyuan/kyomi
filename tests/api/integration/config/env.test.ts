import { describe, expect, test } from "bun:test";
import {
  embeddingsWorkerUrlFromEnv,
  findMissingFeatureCredentials,
  findWeakProductionSettings,
  httpsUrlFromEnv,
  loadEnv,
} from "@config/env/runtime";

describe("env https URL validation", () => {
  test("accepts https URLs and http URLs on localhost", () => {
    for (const value of [
      "https://kyomi-embeddings.example.workers.dev/embed",
      "http://localhost:8787/embed",
      "http://127.0.0.1:8787/embed",
    ]) {
      expect(httpsUrlFromEnv.safeParse(value).success).toBe(true);
    }
  });

  test("rejects undecrypted dotenvx values, other schemes, and remote plain http", () => {
    for (const value of [
      "encrypted:BAk0bTE2MvmlhtGKTPDt",
      "localhost:8787/embed",
      "javascript:alert(1)",
      "ftp://example.com/embed",
      "file:///etc/passwd",
      "http://kyomi-embeddings.example.workers.dev/embed",
    ]) {
      expect(httpsUrlFromEnv.safeParse(value).success).toBe(false);
    }
  });

  test("requires the embeddings Worker URL to point at /embed", () => {
    expect(
      embeddingsWorkerUrlFromEnv.safeParse("https://kyomi-embeddings.example.workers.dev/embed")
        .success,
    ).toBe(true);
    expect(
      embeddingsWorkerUrlFromEnv.safeParse("https://kyomi-embeddings.example.workers.dev").success,
    ).toBe(false);
  });
});

describe("env embeddings Worker pair validation", () => {
  test("reports the token when only the URL is set, and the URL when only the token is set", () => {
    expect(
      findMissingFeatureCredentials({
        CLOUDFLARE_EMBEDDINGS_URL: "https://kyomi-embeddings.example.workers.dev/embed",
      }),
    ).toEqual([{ flag: "CLOUDFLARE_EMBEDDINGS_URL", key: "CLOUDFLARE_EMBEDDINGS_TOKEN" }]);
    expect(findMissingFeatureCredentials({ CLOUDFLARE_EMBEDDINGS_TOKEN: "token" })).toEqual([
      { flag: "CLOUDFLARE_EMBEDDINGS_TOKEN", key: "CLOUDFLARE_EMBEDDINGS_URL" },
    ]);
  });

  test("accepts both values together or neither", () => {
    expect(
      findMissingFeatureCredentials({
        CLOUDFLARE_EMBEDDINGS_URL: "https://kyomi-embeddings.example.workers.dev/embed",
        CLOUDFLARE_EMBEDDINGS_TOKEN: "token",
      }),
    ).toEqual([]);
    expect(findMissingFeatureCredentials({})).toEqual([]);
  });
});

describe("env feature-flag credential validation", () => {
  test("disabled flags never require credentials", () => {
    const missing = findMissingFeatureCredentials({
      FEATURE_GOOGLE_OAUTH: false,
      FEATURE_SOURCE_YOUTUBE: false,
      FEATURE_SOURCE_REDDIT: false,
      FEATURE_SOURCE_X: false,
      FEATURE_AI_ARTICLE_INTELLIGENCE: false,
    });
    expect(missing).toEqual([]);
  });

  test("enabled flag with missing credentials is reported", () => {
    const missing = findMissingFeatureCredentials({ FEATURE_GOOGLE_OAUTH: true });
    expect(missing.map((m) => m.key).sort()).toEqual(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]);
    expect(missing.every((m) => m.flag === "FEATURE_GOOGLE_OAUTH")).toBe(true);
  });

  test("enabled flag with present credentials passes", () => {
    const missing = findMissingFeatureCredentials({
      FEATURE_GOOGLE_OAUTH: true,
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
    });
    expect(missing).toEqual([]);
  });

  test("empty-string credentials count as missing", () => {
    const missing = findMissingFeatureCredentials({
      FEATURE_SOURCE_YOUTUBE: true,
      YOUTUBE_API_KEY: "",
    });
    expect(missing.map((m) => m.key)).toEqual(["YOUTUBE_API_KEY"]);
  });

  test("only enabled flags contribute missing credentials", () => {
    const missing = findMissingFeatureCredentials({
      FEATURE_SOURCE_REDDIT: true,
      FEATURE_SOURCE_X: false,
      REDDIT_CLIENT_ID: "id",
      // REDDIT_CLIENT_SECRET intentionally absent
    });
    expect(missing.map((m) => m.key)).toEqual(["REDDIT_CLIENT_SECRET"]);
  });
});

describe("timeout settings", () => {
  const env = {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/kyomi_test",
    REDIS_URL: "redis://127.0.0.1:6379",
    WEB_ORIGIN: "http://localhost:3000",
    BETTER_AUTH_SECRET: "test-secret",
  };

  test("default to a 30s statement timeout, a 35s query backstop and short Redis timeouts", () => {
    expect(loadEnv(env)).toMatchObject({
      DATABASE_STATEMENT_TIMEOUT_MS: 30_000,
      DATABASE_QUERY_TIMEOUT_MS: 35_000,
      REDIS_CONNECT_TIMEOUT_MS: 10_000,
      REDIS_COMMAND_TIMEOUT_MS: 5_000,
    });
  });

  test("the client backstop must stay above the statement timeout", () => {
    expect(() =>
      loadEnv({
        ...env,
        DATABASE_STATEMENT_TIMEOUT_MS: "20000",
        DATABASE_QUERY_TIMEOUT_MS: "20000",
      }),
    ).toThrow("Invalid environment variables");
  });

  test("a timeout of 0 turns that limit off without tripping the ordering check", () => {
    expect(
      loadEnv({ ...env, DATABASE_STATEMENT_TIMEOUT_MS: "0", DATABASE_QUERY_TIMEOUT_MS: "10000" }),
    ).toMatchObject({ DATABASE_STATEMENT_TIMEOUT_MS: 0, DATABASE_QUERY_TIMEOUT_MS: 10_000 });
    expect(
      loadEnv({ ...env, DATABASE_STATEMENT_TIMEOUT_MS: "10000", DATABASE_QUERY_TIMEOUT_MS: "0" }),
    ).toMatchObject({ DATABASE_STATEMENT_TIMEOUT_MS: 10_000, DATABASE_QUERY_TIMEOUT_MS: 0 });
  });

  test("a Redis connect timeout of 0 is rejected: it would never connect", () => {
    expect(() => loadEnv({ ...env, REDIS_CONNECT_TIMEOUT_MS: "0" })).toThrow(
      "Invalid environment variables",
    );
  });
});

describe("production settings", () => {
  const production = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/kyomi",
    REDIS_URL: "redis://127.0.0.1:6379",
    WEB_ORIGIN: "https://app.kyomi.example",
    BETTER_AUTH_URL: "https://api.kyomi.example",
    BETTER_AUTH_SECRET: "a".repeat(48),
  };

  test("accepts a complete production environment", () => {
    expect(loadEnv(production)).toMatchObject({ NODE_ENV: "production", OPENAPI_ENABLED: false });
  });

  test("refuses a NODE_ENV that is set but not recognised, instead of running as development", () => {
    for (const NODE_ENV of ["prod", "Production", "staging"]) {
      expect(() => loadEnv({ ...production, NODE_ENV })).toThrow("NODE_ENV must be");
    }
    expect(loadEnv({ ...production, NODE_ENV: undefined })).toMatchObject({
      NODE_ENV: "development",
    });
  });

  test("refuses a short session secret, a missing base URL and a short admin secret", () => {
    expect(() => loadEnv({ ...production, BETTER_AUTH_SECRET: "short" })).toThrow(
      "Invalid environment variables",
    );
    expect(() => loadEnv({ ...production, BETTER_AUTH_URL: undefined })).toThrow(
      "Invalid environment variables",
    );
    expect(() => loadEnv({ ...production, FEED_ADMIN_SHARED_SECRET: "admin" })).toThrow(
      "Invalid environment variables",
    );
    expect(findWeakProductionSettings({ BETTER_AUTH_SECRET: "short" }).map((i) => i.key)).toEqual([
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_URL",
    ]);
  });

  test("development and test keep their short secrets", () => {
    expect(
      loadEnv({
        ...production,
        NODE_ENV: "test",
        BETTER_AUTH_SECRET: "test-secret",
        BETTER_AUTH_URL: undefined,
      }),
    ).toMatchObject({ NODE_ENV: "test" });
  });
});
