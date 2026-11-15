import { describe, expect, test } from "bun:test";
import { html } from "./render";
import {
  readerDocumentSchema,
  type ReaderBlock,
} from "../../../../../packages/reader/src/core/document";
import { makeDocument } from "./fixtures";
import { highlightCode } from "../../../../../packages/worker/src/document/highlighter";

const native = await import("../../../../../packages/reader/src/native/document");
const { resolveCodeLines, tokenStyle } =
  await import("../../../../../packages/reader/src/native/document/style");

type CodeBlock = Extract<ReaderBlock, { type: "code" }>;

function theme(scheme: "light" | "dark") {
  return native.createReaderNativeTheme({ scheme, availableWidth: 350, inset: 20, fontSize: 17 });
}

function block(value: string, extra: Partial<CodeBlock> = {}): CodeBlock {
  return {
    type: "code",
    value,
    language: "typescript",
    languageSource: "explicit",
    label: "TypeScript",
    ...extra,
  } as CodeBlock;
}

function render(code: CodeBlock, scheme: "light" | "dark" = "light") {
  const doc = readerDocumentSchema.parse(makeDocument([code], []));
  return html(
    <native.ReaderNativeProvider
      value={{
        theme: theme(scheme),
        host: {
          copyText: () => undefined,
          openUrl: () => undefined,
          openFootnote: () => undefined,
          renderImage: () => null,
          renderIsland: () => null,
        },
        footnotes: native.planDocument(doc).footnotes,
      }}
    >
      <native.BlockView block={doc.blocks[0]!} />
    </native.ReaderNativeProvider>,
  );
}

/** The text a reader could select: tags dropped, entities decoded. */
function visibleCode(markup: string): string {
  const scroller = markup.slice(markup.indexOf('data-label="'));
  const body = scroller.slice(scroller.indexOf('code">') + 6);
  return body
    .replace(/<[^>]*>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
}

const displayed = (code: CodeBlock, scheme: "light" | "dark" = "light") =>
  resolveCodeLines(code, scheme)
    .map((line) => line.tokens.map((token) => token.text).join(""))
    .join("\n");

describe("tokenStyle", () => {
  const both = { light: "#d73a49", dark: "#f97583" };

  test("picks the colour for the scheme", () => {
    expect(tokenStyle(both, "light")?.color).toBe("#d73a49");
    expect(tokenStyle(both, "dark")?.color).toBe("#f97583");
  });

  // The web rule: light uses --rt-light only; dark uses --rt-dark, then --rt-light.
  test("matches the web fallback when one scheme has no colour", () => {
    expect(tokenStyle({ dark: "#f97583" }, "light")).toBeUndefined();
    expect(tokenStyle({ light: "#d73a49" }, "dark")?.color).toBe("#d73a49");
  });

  test("ignores colours that are not hex", () => {
    expect(tokenStyle({ light: "red" }, "light")).toBeUndefined();
    expect(tokenStyle({ light: "#d73a49", dark: "url(x)" }, "dark")?.color).toBe("#d73a49");
  });

  test("maps the italic, bold and underline bits", () => {
    expect(tokenStyle({ fontStyle: 1 }, "light")).toEqual({ fontStyle: "italic" });
    expect(tokenStyle({ fontStyle: 2 }, "light")).toEqual({ fontWeight: "700" });
    expect(tokenStyle({ fontStyle: 4 }, "light")).toEqual({ textDecorationLine: "underline" });
    expect(tokenStyle({ light: "#000000", fontStyle: 7 }, "light")).toEqual({
      color: "#000000",
      fontStyle: "italic",
      fontWeight: "700",
      textDecorationLine: "underline",
    });
  });

  test("an empty style is the default", () => {
    expect(tokenStyle({}, "light")).toBeUndefined();
    expect(tokenStyle(undefined, "dark")).toBeUndefined();
  });
});

describe("resolveCodeLines", () => {
  const highlight = {
    engine: "test",
    styles: [{}, { light: "#111111", dark: "#eeeeee", fontStyle: 1 }],
    lines: [[["a", 1]], [], [["\tb", 0]]] as [string, number][][],
  };

  test("shows stored tokens with their scheme colours", () => {
    const lines = resolveCodeLines(block("a\n\n\tb", { highlight }), "dark");
    expect(lines.map((line) => line.tokens.length)).toEqual([1, 0, 1]);
    expect(lines[0]?.tokens[0]?.style).toEqual({ color: "#eeeeee", fontStyle: "italic" });
    expect(lines[2]?.tokens[0]?.style).toBeUndefined();
  });

  test("keeps tabs, empty lines and unicode exactly", () => {
    const value = 'if (x) {\n\treturn "日本語 \u{1F600}";\n\n}';
    expect(displayed(block(value))).toBe(value);
  });

  test("tokens that do not rebuild the value are replaced by plain lines", () => {
    const stale = block("a\nb", { highlight: { ...highlight, lines: [[["a", 1]], [["X", 1]]] } });
    const lines = resolveCodeLines(stale, "light");
    expect(displayed(stale)).toBe("a\nb");
    expect(lines.every((line) => line.tokens.every((token) => !token.style))).toBe(true);
  });

  test("CRLF stays on the line it ended instead of being dropped or doubled", () => {
    const value = "a\r\n\r\nb";
    expect(displayed(block(value))).toBe(value);
  });

  test("a trailing newline does not add a blank line", () => {
    expect(resolveCodeLines(block("a\nb\n"), "light")).toHaveLength(2);
    expect(displayed(block("a\n"))).toBe("a");
    expect(resolveCodeLines(block("a\n\n"), "light")).toHaveLength(2);
    expect(displayed(block("\n"))).toBe("");
    expect(displayed(block(""))).toBe("");
  });

  test("a leading blank line keeps its height", () => {
    expect(resolveCodeLines(block("\nx"), "light")).toHaveLength(2);
  });

  test("an out-of-range style index is plain", () => {
    const wild = block("a", { highlight: { ...highlight, lines: [[["a", 9]]] } });
    expect(resolveCodeLines(wild, "light")[0]?.tokens[0]?.style).toBeUndefined();
  });

  test("emphasis follows 1-based highlightLines and ignores out-of-range ones", () => {
    const lines = resolveCodeLines(block("a\nb\nc", { highlightLines: [2, 9] }), "light");
    expect(lines.map((line) => line.emphasized)).toEqual([false, true, false]);
  });
});

describe("CodeBlockView", () => {
  test("renders exactly the stored code, selectable, with one copy button", () => {
    const value = "const a = 1;\n\tconst b = '<x>' & \"y\";\n\nend";
    const out = render(block(value));
    expect(visibleCode(out)).toBe(value);
    expect(out).toContain('data-selectable="true"');
    expect(out.match(/data-pressable="true"/g)).toHaveLength(1);
    expect(out).toContain('data-label="Copy code"');
  });

  test("the on-screen text of real highlighter output equals the value", async () => {
    const samples: [string, string][] = [
      ["typescript", 'export const a: number = 1;\n\nfunction f() {\n\treturn "日本語";\n}\n'],
      ["python", "def f():\n\n    return 1\n"],
      ["shellscript", "$ echo 'hi' && ls\n"],
      ["markdown", "# t\n\n```js\nconst a = 1;\n```\n"],
    ];
    for (const [language, value] of samples) {
      const highlight = await highlightCode(value, language);
      expect(highlight).not.toBeNull();
      const code = block(value, { language, highlight: highlight ?? undefined });
      for (const scheme of ["light", "dark"] as const) {
        expect(displayed(code, scheme)).toBe(value.replace(/\n$/, ""));
        expect(visibleCode(render(code, scheme))).toBe(value.replace(/\n$/, ""));
      }
    }
  });

  test("native colours are the web's colours for the same block", async () => {
    const value = "const a: string = 'x'; // note\n";
    const highlight = (await highlightCode(value, "typescript"))!;
    const code = block(value, { highlight });
    const web = (scheme: "light" | "dark", index: number) => {
      const style = highlight.styles[index]!;
      return scheme === "dark" ? (style.dark ?? style.light) : style.light;
    };
    for (const scheme of ["light", "dark"] as const) {
      const rendered = resolveCodeLines(code, scheme)[0]!.tokens;
      highlight.lines[0]!.forEach(([, index], position) => {
        expect(rendered[position]?.style?.color).toBe(index > 0 ? web(scheme, index) : undefined);
      });
    }
  });
});
