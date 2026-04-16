import { describe, expect, test } from "bun:test";
import {
  assertHttpOrHttpsUrl,
  normalizeFeedUrl,
} from "@modules/discover/discover.normalize-feed-url";

describe("normalizeFeedUrl", () => {
  test("lowercases host and strips hash", () => {
    expect(normalizeFeedUrl("HTTPS://Example.COM/path#frag")).toBe("https://example.com/path");
  });
});

describe("assertHttpOrHttpsUrl", () => {
  test("accepts https", () => {
    expect(assertHttpOrHttpsUrl("https://a.com/x").href).toBe("https://a.com/x");
  });

  test("rejects mailto", () => {
    expect(() => assertHttpOrHttpsUrl("mailto:a@b.com")).toThrow();
  });
});
