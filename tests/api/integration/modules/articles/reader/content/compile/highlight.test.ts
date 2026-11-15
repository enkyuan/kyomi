import { describe, expect, test } from "bun:test";
import {
  highlightCode,
  isHighlightableLanguage,
  MAX_HIGHLIGHT_CHARS,
  MAX_HIGHLIGHT_LINES,
  MAX_HIGHLIGHT_LINE_CHARS,
  type CodeHighlight,
} from "../../../../../../../../packages/worker/src/document/highlighter";

const HEX = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;

function rebuild(highlight: CodeHighlight): string {
  return highlight.lines.map((line) => line.map(([text]) => text).join("")).join("\n");
}

function expectValid(highlight: CodeHighlight, value: string) {
  expect(rebuild(highlight)).toBe(value);
  expect(highlight.styles[0]).toEqual({});
  for (const style of highlight.styles) {
    for (const colour of [style.light, style.dark]) {
      if (colour !== undefined) expect(colour).toMatch(HEX);
    }
    expect(style.fontStyle ?? 0).toBeLessThanOrEqual(7);
  }
  for (const line of highlight.lines) {
    for (const [, index] of line) {
      expect(index).toBeLessThan(highlight.styles.length);
    }
  }
}

describe("highlightCode", () => {
  // Value-exactness: the renderers rebuild the code from these tokens.
  test.each([
    ["tabs", "go", "func a() {\n\tif x {\n\t\treturn\n\t}\n}\n"],
    ["trailing newline", "rust", "fn main() {}\n"],
    ["blank lines", "python", "a = 1\n\n\nb = 2\n\n"],
    ["only newlines", "javascript", "\n\n"],
    ["empty", "javascript", ""],
    ["wide and combining", "javascript", 'const s = "日本語 \u{1F600} é";'],
    ["line separators", "javascript", "a b\u0085c d"],
    ["control characters", "javascript", "a\u0000b\u001bc"],
    ["bom", "javascript", "﻿const a = 1;"],
  ])("rebuilds %s exactly", async (_name, language, value) => {
    const highlight = await highlightCode(value, language);
    if (highlight) expectValid(highlight, value);
  });

  test("keeps well-formed code coloured", async () => {
    const value = "const a = 1;\n";
    const highlight = await highlightCode(value, "typescript");
    expect(highlight).not.toBeNull();
    expectValid(highlight as CodeHighlight, value);
    expect((highlight as CodeHighlight).styles.length).toBeGreaterThan(1);
  });

  test("declines CRLF input rather than returning tokens that lost the CR", async () => {
    expect(await highlightCode("const a = 1;\r\nconst b = 2;\r\n", "javascript")).toBeNull();
  });

  // Hints the classifier resolves to canonical ids and the aliases Shiki bundles.
  test.each([
    "jsonc",
    "tsx",
    "jsx",
    "vue",
    "svelte",
    "astro",
    "mdx",
    "zsh",
    "console",
    "sh",
    "yml",
    "rs",
    "py",
    "rb",
    "kt",
    "cs",
    "objc",
    "shellscript",
    "shellsession",
    "csharp",
    "objective-c",
  ])("resolves %s", async (language) => {
    expect(isHighlightableLanguage(language)).toBe(true);
    expect(await highlightCode("x = 1\n", language)).not.toBeNull();
  });

  test.each(["golang", "shell-session", "plaintext", "text", "nope", ""])(
    "leaves %j plain",
    async (language) => {
      expect(isHighlightableLanguage(language)).toBe(false);
      expect(await highlightCode("x = 1\n", language)).toBeNull();
    },
  );

  test("inherited object keys are not languages and do not poison later calls", async () => {
    for (const key of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"]) {
      expect(isHighlightableLanguage(key)).toBe(false);
      expect(await highlightCode("x", key)).toBeNull();
    }
    // jsonc is loaded for the first time after the bad ids above.
    expect(await highlightCode('{ "a": 1 }', "jsonc")).not.toBeNull();
    expect(await highlightCode("x = 1\n", "yaml")).not.toBeNull();
  });

  test("a very long line stays plain instead of tokenizing for tens of seconds", async () => {
    const started = performance.now();
    const long = `const a = "${"x".repeat(25_000)}";`;
    expect(await highlightCode(long, "javascript")).toBeNull();
    expect(performance.now() - started).toBeLessThan(1_000);
    const atLimit = `const a = "${"x".repeat(MAX_HIGHLIGHT_LINE_CHARS - 13)}";`;
    expect(atLimit.length).toBe(MAX_HIGHLIGHT_LINE_CHARS);
    expect(await highlightCode(atLimit, "javascript")).not.toBeNull();
  });

  test("size caps degrade to plain, never to partial tokens", async () => {
    expect(await highlightCode("a".repeat(MAX_HIGHLIGHT_CHARS + 1), "javascript")).toBeNull();
    expect(await highlightCode("a\n".repeat(MAX_HIGHLIGHT_LINES), "javascript")).toBeNull();
    const edge = Array.from({ length: 30 }, () => "a".repeat(1000))
      .join("\n")
      .slice(0, MAX_HIGHLIGHT_CHARS);
    expect(edge.length).toBe(MAX_HIGHLIGHT_CHARS);
    const atCap = await highlightCode(edge, "javascript");
    expect(atCap).not.toBeNull();
    expectValid(atCap as CodeHighlight, edge);
    const lines = Array.from({ length: MAX_HIGHLIGHT_LINES }, () => "a").join("\n");
    const atLineCap = await highlightCode(lines, "javascript");
    expect(atLineCap).not.toBeNull();
    expectValid(atLineCap as CodeHighlight, lines);
  });

  // Shiki treats lazily embedded grammars (markdown fences, vue blocks, ruby heredocs) as plain
  // until something else loads them, which made output depend on request order.
  test("tokenizes a snippet identically whichever languages were loaded before", async () => {
    const fenced = "# hi\n\n```js\nconst a = 1;\n```\n";
    const first = await highlightCode(fenced, "markdown");
    await highlightCode("const a = 1", "javascript");
    await highlightCode("print(1)", "python");
    const later = await highlightCode(fenced, "markdown");
    expect(later).toEqual(first);
    expect(first?.styles.length).toBeGreaterThan(2);
    // The fence body is coloured as JavaScript: `const` is a keyword token, not plain text.
    const constToken = first?.lines.flat().find(([text]) => text === "const");
    expect(constToken?.[1]).toBeGreaterThan(0);
  });

  test("is deterministic across repeated calls", async () => {
    const value = "<template><p>{{ a }}</p></template>\n<script>\nexport default {}\n</script>\n";
    expect(await highlightCode(value, "vue")).toEqual(await highlightCode(value, "vue"));
  });
});
