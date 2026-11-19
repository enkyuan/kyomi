import { describe, expect, test } from "bun:test";
import {
  htmlLooksLikeWrappedMarkdown,
  looksLikeHtml,
  looksLikeMarkdown,
  normalizeText,
} from "@modules/articles/reader/content/signals";
import { expectLinear, hostileInputs } from "@api-tests/support/hostile-text";

describe("articles.reader.signals", () => {
  describe("looksLikeHtml", () => {
    test("needs a tag-shaped < followed by a later >", () => {
      expect(looksLikeHtml("<p>Hello</p>")).toBe(true);
      expect(looksLikeHtml("text with <b>bold</b> inside")).toBe(true);
      expect(looksLikeHtml("<a")).toBe(false);
      expect(looksLikeHtml("<a>")).toBe(true);
      expect(looksLikeHtml("a < b and c > d")).toBe(false);
      expect(looksLikeHtml("> before <b")).toBe(false);
      expect(looksLikeHtml("<1>")).toBe(false);
      expect(looksLikeHtml("")).toBe(false);
    });
  });

  describe("looksLikeMarkdown", () => {
    test("recognises ordinary markdown documents", () => {
      expect(looksLikeMarkdown("```ts\nconst x = 1;\n```")).toBe(true);
      expect(looksLikeMarkdown("# Title\n\nSome intro.\n\n- one\n- two\n")).toBe(true);
      expect(looksLikeMarkdown("| a | b |\n|---|---|\n| 1 | 2 |")).toBe(true);
      expect(looksLikeMarkdown("| a | b |\r\n|---|---|\r\n| 1 | 2 |\r\n")).toBe(true);
      expect(looksLikeMarkdown("Title\n=====\n\nBody text here.")).toBe(true);
      expect(looksLikeMarkdown("See [the docs](https://example.com/docs) for more.")).toBe(true);
      expect(looksLikeMarkdown("Use `npm install` first.")).toBe(true);
      expect(looksLikeMarkdown("---\n~~gone~~")).toBe(true);
    });

    test("leaves plain prose alone", () => {
      expect(looksLikeMarkdown("Just a plain sentence about nothing in particular.")).toBe(false);
      expect(looksLikeMarkdown("Costs $5 today and $6 tomorrow.\n\nSecond paragraph.")).toBe(false);
      expect(looksLikeMarkdown("")).toBe(false);
    });

    test("applies the length thresholds to the whole value, not the scored prefix", () => {
      const prose = "Plain words that say nothing special. ".repeat(100);
      expect(prose.length).toBeGreaterThan(2_600);
      // One inline signal (score 4) is not enough for a long document...
      expect(looksLikeMarkdown(`See [docs](https://example.com).\n${prose}`)).toBe(false);
      // ...but a heading makes a long document markdown even though it scores only 4.
      expect(looksLikeMarkdown(`# Heading\n${prose}`)).toBe(true);
      // Signals beyond the first 32,000 characters are not scored.
      expect(looksLikeMarkdown(`${"word ".repeat(7_000)}\n\`\`\`js\nx\n\`\`\`\n- a\n- b`)).toBe(
        false,
      );
    });
  });

  describe("htmlLooksLikeWrappedMarkdown", () => {
    test("is true only when no structural tags were rendered", () => {
      expect(htmlLooksLikeWrappedMarkdown("<div># Title</div>")).toBe(true);
      expect(htmlLooksLikeWrappedMarkdown("<div><h1>Title</h1></div>")).toBe(false);
      expect(htmlLooksLikeWrappedMarkdown("<div><pre>code</pre></div>")).toBe(false);
    });
  });

  describe("normalizeText", () => {
    test("drops scripts, styles, tags, entities and URLs", () => {
      expect(
        normalizeText(
          "<p>Hello <b>World</b></p><script>evil()</script><style>.a{}</style> &amp; https://x.test/a",
        ),
      ).toBe("hello world");
    });

    test("removes script and style elements case-insensitively, and an unclosed script to the end", () => {
      expect(normalizeText("a<SCRIPT type=x>b</SCRIPT>c<STYLE>d</STYLE>e")).toBe("a c e");
      expect(normalizeText("keep <script>drop everything after")).toBe("keep");
    });

    test("does not treat <scripts> or <styles> as script or style elements", () => {
      expect(normalizeText("a <scripts>b</scripts> c")).toBe("a b c");
    });
  });

  for (const [name, input] of Object.entries(hostileInputs)) {
    test(`stays linear on hostile text: ${name}`, () => {
      expectLinear(() => normalizeText(input));
      expectLinear(() => looksLikeHtml(input));
      expectLinear(() => looksLikeMarkdown(input));
      expectLinear(() => htmlLooksLikeWrappedMarkdown(input));
    });
  }
});
