import { bundledLanguages, bundledThemes, createOnigurumaEngine } from "shiki";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";

/** Pinned with the dependency version so stored tokens say which engine produced them. */
export const HIGHLIGHT_ENGINE = "shiki@4.5.0:github-light/github-dark";

export const MAX_HIGHLIGHT_CHARS = 30_000;
export const MAX_HIGHLIGHT_LINES = 1_500;

type Style = { light?: string; dark?: string; fontStyle?: number };
export type CodeHighlight = {
  engine: string;
  styles: Style[];
  lines: [string, number][][];
};

const HEX = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;

let highlighter: Promise<HighlighterCore> | undefined;
const loaded = new Set<string>();

function getHighlighter(): Promise<HighlighterCore> {
  highlighter ??= createHighlighterCore({
    themes: [bundledThemes["github-light"], bundledThemes["github-dark"]],
    langs: [],
    // The reference Oniguruma engine: the JavaScript engine tokenized a language differently on
    // its first and later calls, which would make stored tokens depend on request order.
    engine: createOnigurumaEngine(import("shiki/wasm")),
  });
  return highlighter;
}

function fontStyleOf(style: Record<string, string>): number {
  let bits = 0;
  for (const mode of ["light", "dark"]) {
    if (style[`--shiki-${mode}-font-style`] === "italic") {
      bits |= 1;
    }
    if (style[`--shiki-${mode}-font-weight`] === "bold") {
      bits |= 2;
    }
    if (style[`--shiki-${mode}-text-decoration`]?.includes("underline")) {
      bits |= 4;
    }
  }
  return bits;
}

/**
 * Dual-theme tokens for `value`, or null when the language is not bundled, the input exceeds the
 * size cap, or the engine fails. Style index 0 is always the unstyled default.
 */
export async function highlightCode(
  value: string,
  language: string,
): Promise<CodeHighlight | null> {
  if (
    value.length > MAX_HIGHLIGHT_CHARS ||
    value.split("\n").length > MAX_HIGHLIGHT_LINES ||
    !(language in bundledLanguages)
  ) {
    return null;
  }
  try {
    const engine = await getHighlighter();
    if (!loaded.has(language)) {
      await engine.loadLanguage(bundledLanguages[language as keyof typeof bundledLanguages]);
      loaded.add(language);
    }
    const { tokens } = engine.codeToTokens(value, {
      lang: language,
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    });
    const styles: Style[] = [{}];
    const index = new Map<string, number>();
    const lines = tokens.map((line) =>
      line.map((token): [string, number] => {
        const css = (token.htmlStyle ?? {}) as Record<string, string>;
        const light = HEX.test(css["--shiki-light"] ?? "") ? css["--shiki-light"] : undefined;
        const dark = HEX.test(css["--shiki-dark"] ?? "") ? css["--shiki-dark"] : undefined;
        const fontStyle = fontStyleOf(css);
        if (!light && !dark && !fontStyle) {
          return [token.content, 0];
        }
        const key = `${light ?? ""}|${dark ?? ""}|${fontStyle}`;
        let position = index.get(key);
        if (position === undefined) {
          position = styles.length;
          styles.push({
            ...(light ? { light } : {}),
            ...(dark ? { dark } : {}),
            ...(fontStyle ? { fontStyle } : {}),
          });
          index.set(key, position);
        }
        return [token.content, position];
      }),
    );
    // The renderer rebuilds the code from these tokens, so a mismatch would corrupt it.
    if (lines.map((line) => line.map(([text]) => text).join("")).join("\n") !== value) {
      return null;
    }
    return { engine: HIGHLIGHT_ENGINE, styles, lines };
  } catch {
    return null;
  }
}
