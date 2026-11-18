import { describe, expect, test } from "bun:test";
import { parseFeedMetadata, parseHtmlMetadataFallback } from "@modules/discover/feed/parse";
import { expectLinear, hostileInputs } from "@api-tests/support/hostile-text";

describe("parseFeedMetadata", () => {
  test("parses minimal RSS 2.0", () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>My &#8216;Blog&#8217;</title><link>https://blog.example/</link><description>Desc &amp; more</description><image><url>/icon.png</url></image></channel></rss>`;
    const meta = parseFeedMetadata(xml, "https://fallback/");
    expect(meta.title).toBe("My ‘Blog’");
    expect(meta.link).toBe("https://blog.example/");
    expect(meta.description).toBe("Desc & more");
    expect(meta.iconUrl).toBe("https://fallback/icon.png");
  });

  test("resolves relative RSS channel links against the final feed URL", () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>Relative site</title><link>/</link><description>Updates</description></channel></rss>`;
    const meta = parseFeedMetadata(xml, "https://www.entrepreneur.com/rss-feed");
    expect(meta.link).toBe("https://www.entrepreneur.com/");
  });

  test("parses JSON Feed", () => {
    const json = JSON.stringify({
      version: "https://jsonfeed.org/version/1",
      title: "JSON site",
      description: "About",
      home_page_url: "https://json.example/",
      favicon: "/favicon.ico",
    });
    const meta = parseFeedMetadata(json, "https://fallback/");
    expect(meta.title).toBe("JSON site");
    expect(meta.link).toBe("https://json.example/");
    expect(meta.iconUrl).toBe("https://fallback/favicon.ico");
  });

  test("parses Atom icon and logo metadata", () => {
    const xml = `<?xml version="1.0"?><feed><title>Atom site</title><subtitle>Updates</subtitle><link href="https://atom.example/" rel="alternate"/><icon>/atom-icon.png</icon><logo>/logo.png</logo></feed>`;
    const meta = parseFeedMetadata(xml, "https://feeds.example/atom.xml");
    expect(meta.title).toBe("Atom site");
    expect(meta.link).toBe("https://atom.example/");
    expect(meta.iconUrl).toBe("https://feeds.example/atom-icon.png");
  });
});

describe("parseFeedMetadata markup stripping", () => {
  test("strips markup from CDATA titles and JSON descriptions", () => {
    const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title><![CDATA[<b>Bold</b> &amp; text]]></title><link>https://blog.example/</link><description>D</description></channel></rss>`;
    expect(parseFeedMetadata(xml, "https://fallback/").title).toBe("Bold & text");

    const json = JSON.stringify({ title: "<i>Hi</i> there", description: "a <br/> b" });
    const meta = parseFeedMetadata(json, "https://fallback/");
    expect(meta.title).toBe("Hi there");
    expect(meta.description).toBe("a b");
  });

  for (const [name, input] of Object.entries(hostileInputs)) {
    test(`stays linear on hostile feed text: ${name}`, () => {
      const xml = `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><description><![CDATA[${input}]]></description></channel></rss>`;
      expectLinear(() => parseFeedMetadata(xml, "https://fallback/"));

      const json = JSON.stringify({ title: input, description: input });
      expectLinear(() => parseFeedMetadata(json, "https://fallback/"));
    });
  }
});

describe("parseHtmlMetadataFallback", () => {
  const page = `<!doctype html><html><head><title>Example &amp; Co</title>
    <meta name="description" content="A page about things">
    <link rel="stylesheet" href="/app.css">
    <link rel="shortcut icon" href="/favicon.ico"></head><body><p>hi</p></body></html>`;

  test("reads the title, description and icon from the head", () => {
    expect(parseHtmlMetadataFallback(page, "https://example.com/blog/")).toEqual({
      title: "Example & Co",
      description: "A page about things",
      link: "https://example.com/blog/",
      iconUrl: "https://example.com/favicon.ico",
    });
  });

  test("falls back to Open Graph metadata and the first 32 KiB without a head", () => {
    const html = `<meta content="OG description" property="og:description"><meta property="og:title" content="OG title"><link rel="icon" href="/og.ico">`;
    expect(parseHtmlMetadataFallback(html, "https://example.com/")).toMatchObject({
      title: "OG title",
      description: "OG description",
      iconUrl: "https://example.com/og.ico",
    });
  });

  test("matches head, title and link tags case-insensitively", () => {
    const html = `<HTML><HEAD><TITLE>Upper</TITLE><LINK REL="ICON" HREF="/up.ico"></HEAD></HTML>`;
    expect(parseHtmlMetadataFallback(html, "https://example.com/")).toMatchObject({
      title: "Upper",
      iconUrl: "https://example.com/up.ico",
    });
  });

  test("does not mistake <header>, <headline> or <linkedin> for head or link", () => {
    const html = `<header><title>Header title</title><link rel="icon" href="/header.ico"></header>
      <headline>x</headline>
      <head><linkedin rel="icon" href="/linkedin.ico"><title>Real</title><link rel="icon" href="/real.ico"></head>`;
    expect(parseHtmlMetadataFallback(html, "https://example.com/")).toMatchObject({
      title: "Real",
      iconUrl: "https://example.com/real.ico",
    });
  });

  for (const [name, input] of Object.entries(hostileInputs)) {
    test(`stays linear on a hostile page: ${name}`, () => {
      expectLinear(() => parseHtmlMetadataFallback(input, "https://example.com/"));
      expectLinear(() =>
        parseHtmlMetadataFallback(`<head>${input}</head>`, "https://example.com/"),
      );
    });
  }

  test("finds nothing when the real head sits behind more than 256 KiB of unterminated junk", () => {
    const html = `${"<a".repeat(200_000)}<head><title>Hidden</title><link rel="icon" href="/hidden.ico"></head>`;
    let meta: ReturnType<typeof parseHtmlMetadataFallback> | undefined;
    expectLinear(() => {
      meta = parseHtmlMetadataFallback(html, "https://example.com/");
    });
    expect(meta).toMatchObject({ title: "Untitled", iconUrl: null });
  });

  test("still finds a head that follows a shorter run of unterminated junk", () => {
    const html = `${"<a".repeat(50_000)}<head><title>Found</title><link rel="icon" href="/found.ico"></head>`;
    expect(parseHtmlMetadataFallback(html, "https://example.com/")).toMatchObject({
      title: "Found",
      iconUrl: "https://example.com/found.ico",
    });
  });
});
