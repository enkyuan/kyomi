import { describe, expect, test } from "bun:test";
import { assertHttpOrHttpsUrl, normalizeFeedUrl } from "@modules/discover/feed/normalize";

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

  test("rejects a URL that carries a username or password", () => {
    for (const url of [
      "https://user:s3cret@example.com/feed.xml",
      "https://user@example.com/feed.xml",
      "http://:s3cret@example.com/feed.xml",
    ]) {
      expect(() => assertHttpOrHttpsUrl(url)).toThrow("username or password");
    }
  });

  test("still accepts a query string and a port", () => {
    expect(assertHttpOrHttpsUrl("https://example.com:8443/feed?format=rss").href).toBe(
      "https://example.com:8443/feed?format=rss",
    );
  });
});
