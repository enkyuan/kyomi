import { describe, expect, test } from "bun:test";
import {
  embeddingsWorkerUrlFromEnv,
  findMissingFeatureCredentials,
  httpsUrlFromEnv,
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
