import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { BadRequest, PayloadTooLarge } from "@shared/effect/errors";
import { parseOpmlDocument } from "@modules/opml/parse";
import { buildOpml } from "./fixtures";

const parse = (xml: string) => Effect.runSync(parseOpmlDocument(xml, "Unsorted"));
const parseFailure = (xml: string) =>
  Effect.runSync(Effect.flip(parseOpmlDocument(xml, "Unsorted")));
const feedUrls = (xml: string) => parse(xml).feeds.map((feed) => feed.xmlUrl);

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
    const urls = feedUrls(sampleOpml);
    expect(urls).toEqual([
      "https://a.example/feed",
      "HTTPS://b.example/rss",
      "https://c.example/atom",
    ]);
  });

  test("extracts metadata and assigns feeds to the innermost folder", () => {
    const parsed = parse(sampleOpml);
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
    expect(feedUrls(xml)).toEqual(["https://same.example/f"]);
  });

  test("measures UTF-8 bytes instead of UTF-16 code units", () => {
    const xml = buildOpml(1).replace("Feed 0", "😀".repeat(9_000_000));
    expect(parseFailure(xml)).toMatchObject({ _tag: "PayloadTooLarge", code: "OPML_TOO_LARGE" });
  });

  test("preserves case-sensitive path and query distinctions", () => {
    const xml =
      "<opml><body>" +
      '<outline xmlUrl="https://example.com/Feed?Key=A"/>' +
      '<outline xmlUrl="https://example.com/feed?Key=A"/>' +
      "</body></opml>";
    expect(parse(xml).feeds.map((feed) => feed.normalizedUrl)).toHaveLength(2);
  });

  test("rejects outline nesting deeper than 64", () => {
    expect(parseFailure(buildOpml(1, { depth: 65 }))).toMatchObject({ code: "OPML_TOO_DEEP" });
  });

  test("accepts 100000 feeds and rejects the next distinct feed", () => {
    expect(parse(buildOpml(100_000)).feeds).toHaveLength(100_000);
    expect(parseFailure(buildOpml(100_001))).toMatchObject({ code: "OPML_TOO_MANY" });
  });

  test("fails with OPML_NO_FEEDS when no xmlUrl", () => {
    const error = parseFailure("<opml><body></body></opml>");
    expect(error).toBeInstanceOf(BadRequest);
    expect(error).toMatchObject({ code: "OPML_NO_FEEDS" });
  });

  test("fails with OPML_INVALID without opml.body", () => {
    expect(parseFailure("<opml></opml>")).toMatchObject({
      _tag: "BadRequest",
      code: "OPML_INVALID",
    });
    expect(parseFailure("<other/>")).toMatchObject({ _tag: "BadRequest", code: "OPML_INVALID" });
  });

  test("rejects OPML with doctype/entity declarations", () => {
    const xml = `<!DOCTYPE opml [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
      <opml><body><outline xmlUrl="https://a.example/feed"/></body></opml>`;
    expect(parseFailure(xml)).toMatchObject({ _tag: "BadRequest", code: "OPML_UNSAFE_XML" });
  });

  test("fails with OPML_TOO_LARGE for an oversized string", () => {
    const error = parseFailure("x".repeat(32 * 1024 * 1024 + 1));
    expect(error).toBeInstanceOf(PayloadTooLarge);
    expect(error).toMatchObject({ code: "OPML_TOO_LARGE" });
  });

  test("fails with OPML_FEED_URL_INVALID and OPML_URL_TOO_LONG for unusable feed URLs", () => {
    expect(
      parseFailure('<opml><body><outline xmlUrl="ftp://a.example/f"/></body></opml>'),
    ).toMatchObject({
      code: "OPML_FEED_URL_INVALID",
    });
    expect(
      parseFailure(
        `<opml><body><outline xmlUrl="https://a.example/${"x".repeat(5000)}"/></body></opml>`,
      ),
    ).toMatchObject({ code: "OPML_URL_TOO_LONG" });
  });
});
