import { describe, expect, test } from "bun:test";
import { findMissingFeatureCredentials } from "@config/env/runtime";

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
