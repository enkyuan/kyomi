// Value: protects=the add composer imports only what looks like a feed address and searches for everything else;
//   fails_when=bare words, other schemes or hostnames without a dot start being treated as addresses, or addresses stop being normalized;
//   why_new=the import-versus-follow decision had no test;
//   seam=none;
//   no_claim=green does not prove the discover API accepts the normalized address.
import { describe, expect, test } from "bun:test";
import { normalizeFeedUrl } from "../../../../../../apps/mobile/src/modules/feeds/lib/url";

describe("normalizeFeedUrl", () => {
  test.each([
    ["https://example.com/feed.xml", "https://example.com/feed.xml"],
    ["example.com/rss", "https://example.com/rss"],
    ["  http://blog.example.org  ", "http://blog.example.org/"],
  ])("treats %p as an address", (input, expected) => {
    expect(normalizeFeedUrl(input)).toBe(expected);
  });

  test.each(["", "   ", "hacker news", "swift", "ftp://example.com/feed", "mailto:a@b.co"])(
    "treats %p as words to search for",
    (input) => {
      expect(normalizeFeedUrl(input)).toBeNull();
    },
  );
});
