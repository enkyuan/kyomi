import { describe, expect, test } from "bun:test";
import { discoverFeedUrlFromHtml } from "@kyomi/ingest/ingestion";
import {
  elementInner,
  extractHeadHtml,
  firstImageSrc,
  indexOfCloseTag,
  indexOfOpenTag,
  looksLikeHtml,
  looksLikeMarkdown,
  metaContent,
  openTags,
  removeElements,
  removeScriptsAndStyles,
  stripTagMarkup,
} from "@kyomi/ingest/lib/text-scan";
import {
  buildStoredFeedContent,
  extractImageUrl,
  extractReadableTextFromHtml,
  stripTags,
  summarizeText,
} from "../../../../../../packages/ingest/src/lib/feed-text";
import { expectLinear, hostileInputs } from "@api-tests/support/hostile-text";

describe("ingest text-scan", () => {
  describe("tag names", () => {
    test("match case-insensitively and only as whole names", () => {
      expect(indexOfOpenTag("<header><head>", "head")).toBe(8);
      expect(indexOfOpenTag("<HEAD>", "head")).toBe(0);
      expect(indexOfOpenTag("<head/>", "head")).toBe(0);
      expect(indexOfOpenTag("<head\n>", "head")).toBe(0);
      expect(indexOfOpenTag("<heading><head", "head")).toBe(-1);
      expect(indexOfOpenTag("<linkedin><link rel>", "link")).toBe(10);
      expect(indexOfCloseTag("</header></HEAD>", "head")).toBe(9);
      expect(indexOfCloseTag("</head", "head")).toBe(-1);
    });

    test("openTags yields each complete tag and stops at one with no >", () => {
      expect([...openTags("<link a><LINK b><linkedin c><link d", "link")]).toEqual([
        "<link a>",
        "<LINK b>",
      ]);
    });
  });

  describe("stripTagMarkup", () => {
    test("replaces every <...> run and keeps a < that never closes", () => {
      expect(stripTagMarkup("a <b>c</b> d")).toBe("a  c  d");
      expect(stripTagMarkup("a<>b")).toBe("a b");
      expect(stripTagMarkup("<p>x</p>", "")).toBe("x");
      expect(stripTagMarkup("1 < 2")).toBe("1 < 2");
      expect(stripTagMarkup("a < b <i>c</i>")).toBe("a  c ");
      expect(stripTagMarkup("no tags")).toBe("no tags");
    });
  });

  describe("removeElements", () => {
    test("drops each element, matched case-insensitively", () => {
      expect(removeElements("a<script>x</script>b<SCRIPT src=y>z</Script >c", "script")).toBe(
        "a b c",
      );
      expect(removeScriptsAndStyles("<style>a{}</style>x<script>1</script>")).toBe(" x ");
    });

    test("runs an element with no closing tag to the end of the input", () => {
      expect(removeElements("keep <script>drop", "script")).toBe("keep  ");
      expect(removeElements("keep <script>drop</script", "script")).toBe("keep  ");
    });

    test("leaves a <script that never becomes a tag, and other tag names, alone", () => {
      expect(removeElements("keep <script drop", "script")).toBe("keep <script drop");
      expect(removeElements("<scripts>a</scripts>", "script")).toBe("<scripts>a</scripts>");
    });
  });

  describe("elementInner and extractHeadHtml", () => {
    test("return what sits between the opening and closing tag", () => {
      expect(elementInner("<head><title>x</title></head>", "head")).toBe("<title>x</title>");
      expect(elementInner("<header>a</header><head>b</head>", "head")).toBe("b");
      expect(elementInner("<head><title>x", "head")).toBeNull();
      expect(elementInner("<head", "head")).toBeNull();
      expect(extractHeadHtml("<html><HEAD>H</HEAD></html>")).toBe("H");
    });

    test("fall back to the first 32 KiB, and scan only the first 256 KiB", () => {
      expect(extractHeadHtml("x".repeat(40_000))).toBe("x".repeat(32_768));
      expect(extractHeadHtml(`${"x".repeat(300_000)}<head>late</head>`)).toBe("x".repeat(32_768));
      expect(extractHeadHtml(`${"x".repeat(100_000)}<head>early</head>`)).toBe("early");
    });
  });

  describe("metaContent and firstImageSrc", () => {
    test("read the content of the first matching meta tag and the last src of an img", () => {
      const html = `<meta name="other" content="no"><meta content="Both orders" property="og:title"><img data-src="/lazy.png" src="/real.png">`;
      expect(metaContent(html, "property", "og:title")).toBe("Both orders");
      expect(metaContent(html, "name", "description")).toBeNull();
      expect(
        metaContent("<META PROPERTY='og:title' CONTENT='Upper'>", "property", "og:title"),
      ).toBe("Upper");
      expect(firstImageSrc(html)).toBe("/real.png");
      expect(firstImageSrc("<p>none</p>")).toBeNull();
    });
  });

  describe("looksLikeHtml and looksLikeMarkdown", () => {
    test("detect tags, and strike and math only when asked", () => {
      expect(looksLikeHtml("<b>x</b>")).toBe(true);
      expect(looksLikeHtml("a <b")).toBe(false);
      expect(looksLikeMarkdown("---\n~~gone~~")).toBe(false);
      expect(looksLikeMarkdown("---\n~~gone~~", { strikeAndMath: true })).toBe(true);
      expect(looksLikeMarkdown("# Title\n\n- one\n- two\n")).toBe(true);
      expect(looksLikeMarkdown("Plain words and nothing else.")).toBe(false);
    });
  });
});

describe("ingest feed-text", () => {
  test("stripTags keeps the text, drops script and style, decodes entities", () => {
    expect(
      stripTags(
        "<p>Hello <b>World</b></p><script>x()</script><style>.a{}</style>&amp;&nbsp;done &#8216;q&#8217;",
      ),
    ).toBe("Hello World & done ‘q’");
    expect(stripTags("keep <script>drop everything after")).toBe("keep");
    expect(stripTags("<header>Top</header><linkedin>In</linkedin>")).toBe("Top In");
  });

  test("summarizeText truncates long plain text to 280 characters", () => {
    expect(summarizeText("<p>short</p>")).toBe("short");
    const summary = summarizeText(`<p>${"word ".repeat(100)}</p>`);
    expect(summary).toHaveLength(280);
    expect(summary?.endsWith("...")).toBe(true);
    expect(summarizeText(null)).toBeNull();
  });

  test("extractReadableTextFromHtml prefers article, then main, then body", () => {
    expect(
      extractReadableTextFromHtml(
        "<html><body><nav>skip</nav><article><h1>T</h1><p>Body &amp; text</p></article></body></html>",
      ),
    ).toBe("T Body & text");
    expect(extractReadableTextFromHtml("<body><main>Main text</main>tail</body>")).toBe(
      "Main text",
    );
    expect(extractReadableTextFromHtml("<body>Only <i>body</i></body>")).toBe("Only body");
    expect(extractReadableTextFromHtml("<p>No wrapper</p>")).toBe("No wrapper");
    expect(extractReadableTextFromHtml("<article> </article><main>M</main>")).toBe("M");
  });

  test("extractImageUrl prefers og:image, then twitter:image, then the last img src", () => {
    const base = "https://x.test/p/";
    expect(
      extractImageUrl(
        `<img src="/img.png"><meta name="twitter:image" content="/tw.png"><meta property="og:image" content="/og.png">`,
        base,
      ),
    ).toBe("https://x.test/og.png");
    expect(
      extractImageUrl(`<img src="/img.png"><meta name="twitter:image" content="/tw.png">`, base),
    ).toBe("https://x.test/tw.png");
    expect(extractImageUrl(`<img data-src="/lazy.png" src="rel/real.png">`, base)).toBe(
      "https://x.test/p/rel/real.png",
    );
    expect(extractImageUrl("<p>none</p>", base)).toBeNull();
    expect(extractImageUrl(null, base)).toBeNull();
  });

  test("buildStoredFeedContent classifies markdown, prose and HTML bodies", () => {
    expect(buildStoredFeedContent("# Title\n\nSome intro.\n\n- one\n- two\n")).toMatchObject({
      contentSource: "feed_markdown",
      contentMarkdown: "# Title\n\nSome intro.\n\n- one\n- two",
    });
    expect(buildStoredFeedContent("Just a plain sentence.")).toMatchObject({
      contentSource: "text_fallback",
      contentText: "Just a plain sentence.",
    });
    expect(buildStoredFeedContent("<p>Hello <b>world</b></p>")).toMatchObject({
      contentSource: "feed_html",
      contentText: "Hello world",
    });
    expect(buildStoredFeedContent(null)).toMatchObject({ contentSource: "link_only" });
  });

  test("buildStoredFeedContent strips event handlers from text that is not HTML", () => {
    expect(buildStoredFeedContent(`see onclick="x" here`).content).toBe("see here");
  });
});

describe("ingest discoverFeedUrlFromHtml", () => {
  const base = "https://x.test/blog/";

  test("finds the alternate feed link in the head, case-insensitively", () => {
    expect(
      discoverFeedUrlFromHtml(
        `<HTML><HEAD><LINK REL="ALTERNATE" TYPE="application/rss+xml" HREF="/f.xml"></HEAD></HTML>`,
        base,
      ),
    ).toBe("https://x.test/f.xml");
  });

  test("does not mistake <header> for head or <linkedin> for link", () => {
    const html = `<header><link rel="alternate" type="application/rss+xml" href="/wrong.xml"></header>
      <head><linkedin rel="alternate" type="application/rss+xml" href="/bad.xml">
      <link rel="alternate" type="application/atom+xml" href="/right.xml"></head>`;
    expect(discoverFeedUrlFromHtml(html, base)).toBe("https://x.test/right.xml");
  });

  test("falls back to the first 32 KiB when the page has no head", () => {
    expect(
      discoverFeedUrlFromHtml(
        `<link rel="alternate" type="application/atom+xml" href="/loose.xml">`,
        base,
      ),
    ).toBe("https://x.test/loose.xml");
  });

  test("finds nothing when the real head sits behind more than 256 KiB of unterminated junk", () => {
    const html = `${"<a".repeat(200_000)}<head><link rel="alternate" type="application/rss+xml" href="/hidden.xml"></head>`;
    let found: string | null | undefined;
    expectLinear(() => {
      found = discoverFeedUrlFromHtml(html, base);
    });
    expect(found).toBeNull();
  });

  test("still finds a head that follows a shorter run of unterminated junk", () => {
    const html = `${"<a".repeat(50_000)}<head><link rel="alternate" type="application/rss+xml" href="/found.xml"></head>`;
    expect(discoverFeedUrlFromHtml(html, base)).toBe("https://x.test/found.xml");
  });
});

describe("ingest hostile input", () => {
  for (const [name, input] of Object.entries(hostileInputs)) {
    test(`every scan stays linear: ${name}`, () => {
      expectLinear(() => stripTagMarkup(input));
      expectLinear(() => removeScriptsAndStyles(input));
      expectLinear(() => extractHeadHtml(input));
      expectLinear(() => looksLikeHtml(input));
      expectLinear(() => looksLikeMarkdown(input));
      expectLinear(() => stripTags(input));
      expectLinear(() => summarizeText(input));
      expectLinear(() => extractReadableTextFromHtml(input));
      expectLinear(() => extractImageUrl(input, "https://x.test/"));
      expectLinear(() => discoverFeedUrlFromHtml(input, "https://x.test/"));
      expectLinear(() => discoverFeedUrlFromHtml(`<head>${input}</head>`, "https://x.test/"));
      // Input that looks like HTML goes through the document compiler, which is not a text scan.
      const text = looksLikeHtml(input) ? input.replaceAll("<", "&lt;") : input;
      expectLinear(() => buildStoredFeedContent(text));
    });
  }

  test("an unterminated <script removes to the end of the input in one pass", () => {
    expectLinear(() =>
      expect(stripTags(`before <script>${"<script>".repeat(25_000)}`)).toBe("before"),
    );
  });
});
