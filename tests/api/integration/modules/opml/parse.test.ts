import { describe, expect, test } from "bun:test";
import { AppError } from "@shared/errors/app";
import { parseOpmlDocument, parseOpmlFeeds } from "@modules/opml/parse";
import { buildOpml } from "./fixtures";

const sampleOpml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Test Imports</title>
    <ownerName>Feed Curator</ownerName>
  </head>
  <body>
    <outline text="News">
      <outline text="Tech">
        <outline text="A" xmlUrl="https://a.example/feed"/>
        <outline text="B" xmlUrl="HTTPS://b.example/rss"/>
      </outline>
    </outline>
    <outline xmlUrl="https://c.example/atom"/>
  </body>
</opml>`;

describe("parseOpmlDocument", () => {
  test("collects nested xmlUrl values", () => {
    const urls = parseOpmlFeeds(sampleOpml);
    expect(urls).toEqual([
      "https://a.example/feed",
      "HTTPS://b.example/rss",
      "https://c.example/atom",
    ]);
  });

  test("extracts metadata and assigns feeds to the innermost folder", () => {
    const parsed = parseOpmlDocument(sampleOpml, "Unsorted");
    expect(parsed.opmlTitle).toBe("Test Imports");
    expect(parsed.opmlAuthor).toBe("Feed Curator");
    expect(parsed.feeds).toEqual([
      {
        xmlUrl: "https://a.example/feed",
        originalUrl: "https://a.example/feed",
        normalizedUrl: "https://a.example/feed",
        title: "A",
        folderName: "Tech",
      },
      {
        xmlUrl: "HTTPS://b.example/rss",
        originalUrl: "HTTPS://b.example/rss",
        normalizedUrl: "https://b.example/rss",
        title: "B",
        folderName: "Tech",
      },
      {
        xmlUrl: "https://c.example/atom",
        originalUrl: "https://c.example/atom",
        normalizedUrl: "https://c.example/atom",
        title: null,
        folderName: "Unsorted",
      },
    ]);
  });

  test("dedupes duplicate URLs by host case, not path or query case", () => {
    const xml = `<opml><body>
      <outline xmlUrl="https://same.example/f"/>
      <outline xmlUrl="https://SAME.example/f"/>
    </body></opml>`;
    expect(parseOpmlFeeds(xml)).toEqual(["https://same.example/f"]);
  });

  test("measures UTF-8 bytes instead of UTF-16 code units", () => {
    const xml = buildOpml(1).replace("Feed 0", "😀".repeat(9_000_000));
    expect(() => parseOpmlDocument(xml)).toThrow(
      expect.objectContaining({ code: "OPML_TOO_LARGE" }),
    );
  });

  test("preserves case-sensitive path and query distinctions", () => {
    const xml =
      "<opml><body>" +
      '<outline xmlUrl="https://example.com/Feed?Key=A"/>' +
      '<outline xmlUrl="https://example.com/feed?Key=A"/>' +
      "</body></opml>";
    expect(parseOpmlDocument(xml).feeds.map((feed) => feed.normalizedUrl)).toHaveLength(2);
  });

  test("rejects outline nesting deeper than 64", () => {
    expect(() => parseOpmlDocument(buildOpml(1, { depth: 65 }))).toThrow(
      expect.objectContaining({ code: "OPML_TOO_DEEP" }),
    );
  });

  test("accepts 100000 feeds and rejects the next distinct feed", () => {
    expect(parseOpmlDocument(buildOpml(100_000)).feeds).toHaveLength(100_000);
    expect(() => parseOpmlDocument(buildOpml(100_001))).toThrow(
      expect.objectContaining({ code: "OPML_TOO_MANY" }),
    );
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

  test("rejects OPML with doctype/entity declarations", () => {
    const xml = `<!DOCTYPE opml [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
      <opml><body><outline xmlUrl="https://a.example/feed"/></body></opml>`;
    expect(() => parseOpmlFeeds(xml)).toThrow(AppError);
    try {
      parseOpmlFeeds(xml);
    } catch (e) {
      expect((e as AppError).code).toBe("OPML_UNSAFE_XML");
    }
  });

  test("throws OPML_TOO_LARGE for oversized string", () => {
    const huge = "x".repeat(32 * 1024 * 1024 + 1);
    expect(() => parseOpmlFeeds(huge)).toThrow(AppError);
    try {
      parseOpmlFeeds(huge);
    } catch (e) {
      expect((e as AppError).code).toBe("OPML_TOO_LARGE");
    }
  });
});
