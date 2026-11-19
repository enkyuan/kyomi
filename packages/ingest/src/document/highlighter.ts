import { bundledLanguages, bundledThemes, createOnigurumaEngine } from "shiki";
import {
  createHighlighterCore,
  type GrammarState,
  type HighlighterCore,
  type ThemedToken,
} from "shiki/core";

/** Pinned with the dependency version so stored tokens say which engine produced them. */
export const HIGHLIGHT_ENGINE = "shiki@4.5.0:github-light/github-dark";

export const MAX_HIGHLIGHT_CHARS = 30_000;
export const MAX_HIGHLIGHT_LINES = 1_500;
/**
 * Tokenizing is quadratic in line length for a hostile line (an unterminated template literal of
 * `${a ` repeated cost about 50 microseconds per character at 300 characters and 100 at 500, and a
 * 20,000 character line took over 30 seconds), and Shiki's per-line time limit then truncates it
 * by wall clock, which makes the stored tokens depend on machine load. Minified or data-like lines
 * are not worth colouring, so the whole block stays plain. Real code lines are far shorter.
 */
export const MAX_HIGHLIGHT_LINE_CHARS = 300;
/**
 * Characters a whole document may spend on highlighting. The per-block caps above still allow many
 * blocks, so without this one article could hold the CPU for minutes. A counter, so the stored
 * tokens of ordinary code never depend on machine load.
 */
export const MAX_DOCUMENT_HIGHLIGHT_CHARS = 30_000;
/**
 * Milliseconds of slow lines a whole document may spend inside the tokenizer. Characters cannot
 * bound the cost: some grammars take time exponential in the length of a line made of repeated
 * openers (`<a ` x 24 in C#, Markdown, Svelte, ERB and a dozen more costs a second a line at 72
 * characters and stays there up to the line cap), and a regex search cannot be interrupted. So
 * lines are tokenized one at a time, and a document whose slow lines have used this up stops
 * colouring, which bounds it to this plus the one line in flight.
 *
 * Only a slow line (over {@link SLOW_LINE_MS}) is charged, and a grammar's first line in the process
 * is free (it compiles the grammar, about 100 ms for CSS or HTML). Ordinary code is therefore never
 * charged at all, however busy the machine is, and what it is stored as does not depend on load.
 * Only text built to be slow spends this.
 */
export const MAX_DOCUMENT_HIGHLIGHT_MS = 750;
/** What is left of {@link MAX_DOCUMENT_HIGHLIGHT_MS}; one object is shared by a document's blocks. */
export type HighlightClock = { remainingMs: number };
/** A line that takes longer than this (wall time) spends the document's budget. */
const SLOW_LINE_MS = 100;
/**
 * A line still being tokenized after this long is cut off where the tokenizer is (Shiki measures
 * wall time), and the block stays plain: the line took a hundred times what a real one does.
 */
const LINE_TIME_LIMIT_MS = 750;
/** Languages whose grammar this process has already run, so its first line is not charged. */
const warmedLanguages = new Set<string>();

type Style = { light?: string; dark?: string; fontStyle?: number };
export type CodeHighlight = {
  engine: string;
  styles: Style[];
  lines: [string, number][][];
};

const HEX = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i;

let highlighter: Promise<HighlighterCore> | undefined;
/** Resolves once a language and everything it can embed is registered; failures are remembered. */
const loading = new Map<string, Promise<boolean>>();

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

type BundledGrammar = { embeddedLangsLazy?: string[] };

/**
 * Registers `language` plus the grammars it can embed (markdown fences, heredocs, `<script>`).
 * Shiki leaves lazily embedded grammars out, and an unregistered one tokenizes as plain text, so
 * the same snippet would colour differently depending on which languages earlier calls had loaded.
 * Loading the whole closure up front makes the result independent of call order.
 */
async function register(engine: HighlighterCore, language: string): Promise<boolean> {
  const queue = [language];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const next = queue.pop() as string;
    if (visited.has(next) || !isHighlightableLanguage(next)) {
      continue;
    }
    visited.add(next);
    const loader = bundledLanguages[next as keyof typeof bundledLanguages];
    await engine.loadLanguage(loader);
    const grammars = ((await loader()) as { default: BundledGrammar[] }).default;
    for (const grammar of grammars) {
      queue.push(...(grammar.embeddedLangsLazy ?? []));
    }
  }
  return true;
}

function ensureLanguage(engine: HighlighterCore, language: string): Promise<boolean> {
  let pending = loading.get(language);
  if (!pending) {
    pending = register(engine, language).catch(() => false);
    loading.set(language, pending);
  }
  return pending;
}

/** Own keys only: `"constructor" in bundledLanguages` is true and would poison the engine. */
export function isHighlightableLanguage(language: string): boolean {
  return Object.hasOwn(bundledLanguages, language);
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
 * size cap, the document's tokenizing time is spent (`clock`), or the engine fails. Style index 0
 * is always the unstyled default.
 */
export async function highlightCode(
  value: string,
  language: string,
  clock?: HighlightClock,
): Promise<CodeHighlight | null> {
  if (value.length > MAX_HIGHLIGHT_CHARS || !isHighlightableLanguage(language)) {
    return null;
  }
  const sourceLines = value.split("\n");
  if (
    // Shiki splits on CR as well and drops it, which would change the code the renderer rebuilds
    // from the tokens; HTML parsing already normalizes line endings, so compiled values never have one.
    value.includes("\r") ||
    sourceLines.length > MAX_HIGHLIGHT_LINES ||
    sourceLines.some((line) => line.length > MAX_HIGHLIGHT_LINE_CHARS)
  ) {
    return null;
  }
  try {
    const engine = await getHighlighter();
    if (!(await ensureLanguage(engine, language))) {
      return null;
    }
    // One line per call, each continuing from the state the last one ended in: the tokens are the
    // ones a single call gives, and the clock can stop the block between lines.
    const tokens: ThemedToken[][] = [];
    let state: GrammarState | undefined;
    for (const line of sourceLines) {
      if (clock && clock.remainingMs <= 0) {
        return null;
      }
      const started = performance.now();
      const result = engine.codeToTokens(line, {
        lang: language,
        themes: { light: "github-light", dark: "github-dark" },
        defaultColor: false,
        tokenizeTimeLimit: LINE_TIME_LIMIT_MS,
        ...(state ? { grammarState: state } : {}),
      });
      const spent = performance.now() - started;
      const warmUp = !warmedLanguages.has(language);
      warmedLanguages.add(language);
      if (spent >= LINE_TIME_LIMIT_MS * 0.9) {
        // Cut off by the limit: what is left of the line is one plain token, and the next line is
        // likely as bad. Stop colouring this block and the rest of the document.
        if (clock) {
          clock.remainingMs = 0;
        }
        return null;
      }
      if (clock && spent > SLOW_LINE_MS && !warmUp) {
        clock.remainingMs -= spent;
      }
      tokens.push(...result.tokens);
      state = result.grammarState;
    }
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
