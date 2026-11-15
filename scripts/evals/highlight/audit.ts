import {
  highlightCode,
  isHighlightableLanguage,
  MAX_HIGHLIGHT_CHARS,
  MAX_HIGHLIGHT_LINES,
  MAX_HIGHLIGHT_LINE_CHARS,
  type CodeHighlight,
} from "../../../packages/worker/src/document/highlighter";

/** The slice of a stored KDM code block the audit reads. */
export type StoredCodeBlock = {
  value: string;
  language: string | null;
  highlight?: CodeHighlight;
  highlightLines?: number[];
};

export type Issue =
  | "tokens-do-not-rebuild-value"
  | "style-index-out-of-range"
  | "style-zero-is-not-plain"
  | "invalid-colour"
  | "invalid-font-style"
  | "highlight-line-out-of-range"
  | "highlight-line-not-integer";

const HEX = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;

/** Structural checks on what is stored, independent of the highlighter. */
export function auditStored(block: StoredCodeBlock): Issue[] {
  const issues = new Set<Issue>();
  const lineCount = block.value.split("\n").length;
  for (const line of block.highlightLines ?? []) {
    if (!Number.isInteger(line)) issues.add("highlight-line-not-integer");
    else if (line < 1 || line > lineCount) issues.add("highlight-line-out-of-range");
  }
  const { highlight } = block;
  if (!highlight) return [...issues];
  const { styles, lines } = highlight;
  const first = styles[0];
  if (!first || first.light || first.dark || first.fontStyle) issues.add("style-zero-is-not-plain");
  for (const style of styles) {
    for (const colour of [style.light, style.dark]) {
      if (colour !== undefined && !HEX.test(colour)) issues.add("invalid-colour");
    }
    const bits = style.fontStyle;
    if (bits !== undefined && (!Number.isInteger(bits) || bits < 0 || bits > 7)) {
      issues.add("invalid-font-style");
    }
  }
  for (const line of lines) {
    for (const [, index] of line) {
      if (!Number.isInteger(index) || index < 0 || index >= styles.length) {
        issues.add("style-index-out-of-range");
      }
    }
  }
  if (lines.map((line) => line.map(([text]) => text).join("")).join("\n") !== block.value) {
    issues.add("tokens-do-not-rebuild-value");
  }
  return [...issues];
}

/** Why a block with a language has no stored colouring. */
export function plainReason(block: StoredCodeBlock): string | null {
  if (!block.language || block.highlight) return null;
  if (!isHighlightableLanguage(block.language)) return "language-not-bundled";
  if (block.value.length > MAX_HIGHLIGHT_CHARS) return "over-char-cap";
  const lines = block.value.split("\n");
  if (lines.length > MAX_HIGHLIGHT_LINES) return "over-line-cap";
  if (lines.some((line) => line.length > MAX_HIGHLIGHT_LINE_CHARS)) return "over-line-length-cap";
  return "engine-declined";
}

/** Resolved tokens as one comparable string, so two runs can be compared or digested. */
export function fingerprint(highlight: CodeHighlight | null): string {
  if (!highlight) return "null";
  const styles = highlight.styles.map((s) => [s.light ?? null, s.dark ?? null, s.fontStyle ?? 0]);
  return JSON.stringify([styles, highlight.lines]);
}

export type Fixture = { name: string; language: string; value: string };

/** Tricky inputs every run must keep exact: tokens rebuild the value or colouring is declined. */
export const FIXTURES: Fixture[] = [
  { name: "tabs", language: "go", value: "func a() {\n\tif x {\n\t\treturn\n\t}\n}\n" },
  { name: "crlf", language: "javascript", value: "const a = 1;\r\nconst b = 2;\r\n" },
  { name: "crlf-empty-line", language: "python", value: "a = 1\r\n\r\nb = 2" },
  { name: "lone-cr", language: "javascript", value: "a\rb" },
  { name: "trailing-newline", language: "rust", value: "fn main() {}\n" },
  { name: "trailing-blank-lines", language: "rust", value: "fn main() {}\n\n\n" },
  { name: "only-newlines", language: "javascript", value: "\n\n" },
  { name: "empty", language: "javascript", value: "" },
  { name: "leading-blank", language: "python", value: "\n\nprint(1)" },
  { name: "unicode-wide", language: "javascript", value: 'const s = "日本語 \u{1F600} é";' },
  { name: "line-separators", language: "javascript", value: "a b\u0085c d" },
  { name: "nul-and-controls", language: "javascript", value: "a\u0000b\u001bc" },
  { name: "bom", language: "javascript", value: "﻿const a = 1;" },
  { name: "nbsp-and-zero-width", language: "javascript", value: "a b​c" },
  { name: "markdown-fence", language: "markdown", value: "# hi\n\n```js\nconst a = 1;\n```\n" },
  {
    name: "vue-sfc",
    language: "vue",
    value:
      "<template><p>{{ a }}</p></template>\n<script>\nexport default {}\n</script>\n<style>\np { color: red }\n</style>\n",
  },
  {
    name: "html-embeds",
    language: "html",
    value: "<style>a{color:red}</style>\n<script>let a = 1</script>\n",
  },
  {
    name: "very-long-line",
    language: "javascript",
    value: `const a = "${"x".repeat(MAX_HIGHLIGHT_LINE_CHARS * 20)}";`,
  },
];

/** Not a Shiki id or alias, so the classifier deliberately leaves it plain. */
export const UNRESOLVED_ALIASES = ["shell-session", "golang"] as const;

/** Hints the compiler resolves to canonical ids; the highlighter must accept every one. */
export const ALIASES = [
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
  "bash",
  "yml",
  "rs",
  "py",
  "rb",
  "kt",
  "cs",
  "objc",
  "ts",
  "js",
  "md",
  "c++",
  "dockerfile",
] as const;

export { highlightCode, MAX_HIGHLIGHT_CHARS, MAX_HIGHLIGHT_LINES, MAX_HIGHLIGHT_LINE_CHARS };
