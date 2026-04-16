import { describe, expect, test } from "bun:test";
import { AppError } from "@shared/errors/app-error";
import { OPML_MAX_OUTLINES } from "@modules/opml/opml.constants";
import { parseOpmlFeeds } from "@modules/opml/opml.parse";

const sampleOpml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Test</title></head>
  <body>
    <outline text="Folder">
      <outline text="A" xmlUrl="https://a.example/feed"/>
      <outline text="B" xmlUrl="HTTPS://b.example/rss"/>
    </outline>
    <outline xmlUrl="https://c.example/atom"/>
  </body>
</opml>`;

describe("parseOpmlFeeds", () => {
  test("collects nested xmlUrl values and dedupes case-insensitively", () => {
    const urls = parseOpmlFeeds(sampleOpml);
    expect(urls).toEqual([
      "https://a.example/feed",
      "HTTPS://b.example/rss",
      "https://c.example/atom",
    ]);
  });

  test("dedupes duplicate xmlUrl", () => {
    const xml = `<opml><body>
      <outline xmlUrl="https://same.example/f"/>
      <outline xmlUrl="https://SAME.example/f"/>
    </body></opml>`;
    expect(parseOpmlFeeds(xml)).toEqual(["https://same.example/f"]);
  });

  test("throws OPML_NO_FEEDS when no xmlUrl", () => {
    expect(() => parseOpmlFeeds("<opml><body></body></opml>")).toThrow(AppError);
    try {
      parseOpmlFeeds("<opml><body></body></opml>");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("OPML_NO_FEEDS");
    }
  });

  test("throws OPML_INVALID without opml.body", () => {
    expect(() => parseOpmlFeeds("<opml></opml>")).toThrow(AppError);
    try {
      parseOpmlFeeds("<opml></opml>");
    } catch (e) {
      expect((e as AppError).code).toBe("OPML_INVALID");
    }
  });

  test("throws OPML_TOO_MANY when over limit", () => {
    const n = OPML_MAX_OUTLINES + 1;
    const outlines = Array.from(
      { length: n },
      (_, i) => `<outline xmlUrl="https://x${i}.test/feed"/>`,
    ).join("");
    const xml = `<opml><body>${outlines}</body></opml>`;
    expect(() => parseOpmlFeeds(xml)).toThrow(AppError);
    try {
      parseOpmlFeeds(xml);
    } catch (e) {
      expect((e as AppError).code).toBe("OPML_TOO_MANY");
    }
  });

  test("throws OPML_TOO_LARGE for oversized string", () => {
    const huge = "x".repeat(2 * 1024 * 1024 + 1);
    expect(() => parseOpmlFeeds(huge)).toThrow(AppError);
    try {
      parseOpmlFeeds(huge);
    } catch (e) {
      expect((e as AppError).code).toBe("OPML_TOO_LARGE");
    }
  });
});
