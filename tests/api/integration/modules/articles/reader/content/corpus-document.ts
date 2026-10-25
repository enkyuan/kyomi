import { JSDOM } from "jsdom";
import type { ReaderBlock, ReaderDocument, ReaderInline } from "@kyomi/reader/document";
import { CORPUS_DIR } from "./corpus";

/**
 * KDM side of the fidelity corpus. Each fixture is compiled with `compileArticleDocument` and
 * scored against the sanitized HTML body the same compile produced (the contract the document
 * must keep) and against the authored element counts in `manifest.json`.
 */

export const DOCUMENT_ELEMENT_TYPES = [
  "heading",
  "code",
  "table",
  "list",
  "image",
  "embed",
  "video",
  "audio",
  "math",
  "callout",
  "details",
  "quote",
  "definitionList",
  "divider",
  "footnote",
] as const;
export type DocumentElementType = (typeof DOCUMENT_ELEMENT_TYPES)[number];

export type DocumentExpectation = {
  /** Elements the author published, by KDM type; chrome the compiler drops is not counted. */
  elements: Partial<Record<DocumentElementType, number>>;
  /** `html` escape-hatch blocks the fixture is allowed to need. */
  htmlBlocks: number;
};

export type DocumentFixtureReport = {
  valid: boolean;
  warnings: string[];
  words: number;
  /** Share of the HTML body's words present in the document (multiset). */
  textRecall: number;
  /** Longest common word subsequence over the HTML body's words: reading order preserved. */
  order: number;
  elements: Partial<Record<DocumentElementType, { expected: number; actual: number }>>;
  htmlBlocks: number;
};

export type DocumentCorpusReport = {
  compilerVersion: string;
  documentVersion: number;
  summary: {
    fixtures: number;
    valid: number;
    htmlBlocks: number;
    textRecall: number;
    order: number;
    elementRecall: number;
    elements: Partial<
      Record<DocumentElementType, { expected: number; actual: number; recall: number }>
    >;
  };
  fixtures: Record<string, DocumentFixtureReport>;
};

export function documentBaselineUrl(compilerVersion: string, file: string): URL {
  return new URL(`document/${compilerVersion}/${file}`, CORPUS_DIR);
}

/* ------------------------------------------------------------------ walking */

function inlineList(block: ReaderBlock): ReaderInline[][] {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return [block.children];
    case "pullQuote":
      return [block.children, block.attribution ?? []];
    case "quote":
      return [block.attribution ?? []];
    case "figure":
      return [block.caption ?? [], block.credit ?? []];
    case "gallery":
      return [...block.items.map((item) => item.caption ?? []), block.caption ?? []];
    case "table":
      return [block.caption ?? []];
    case "callout":
      return [block.title ?? []];
    case "details":
      return [block.summary];
    case "definitionList":
      return block.items.flatMap((item) => item.terms);
    case "video":
    case "audio":
    case "embed":
      return [block.caption ?? []];
    default:
      return [];
  }
}

function nested(block: ReaderBlock): ReaderBlock[][] {
  switch (block.type) {
    case "list":
      return block.items.map((item) => item.children);
    case "quote":
    case "callout":
    case "details":
    case "mediaText":
      return [block.children];
    case "table":
      return [block.head, block.body, block.foot ?? []].flatMap((rows) =>
        rows.flatMap((row) => row.map((cell) => cell.children)),
      );
    case "definitionList":
      return block.items.flatMap((item) => item.definitions);
    default:
      return [];
  }
}

function walk(blocks: ReaderBlock[], visit: (block: ReaderBlock) => void): void {
  for (const block of blocks) {
    visit(block);
    for (const children of nested(block)) {
      walk(children, visit);
    }
  }
}

function walkInlines(inlines: ReaderInline[], visit: (inline: ReaderInline) => void): void {
  for (const inline of inlines) {
    visit(inline);
    if ("children" in inline) {
      walkInlines(inline.children, visit);
    }
  }
}

function allBlocks(document: ReaderDocument): ReaderBlock[] {
  const blocks: ReaderBlock[] = [];
  walk(document.blocks, (block) => blocks.push(block));
  for (const footnote of document.footnotes) {
    walk(footnote.children, (block) => blocks.push(block));
  }
  return blocks;
}

/* ------------------------------------------------------------------- scoring */

export function documentElementCounts(
  document: ReaderDocument,
): Record<DocumentElementType, number> {
  const counts = Object.fromEntries(DOCUMENT_ELEMENT_TYPES.map((type) => [type, 0])) as Record<
    DocumentElementType,
    number
  >;
  for (const block of allBlocks(document)) {
    switch (block.type) {
      case "figure":
        counts.image += 1;
        break;
      case "gallery":
        counts.image += block.items.length;
        break;
      case "mediaText":
        counts.image += 1;
        break;
      case "quote":
      case "pullQuote":
        counts.quote += 1;
        break;
      case "embed":
      case "linkCard":
        counts.embed += 1;
        break;
      case "math":
        counts.math += 1;
        break;
      case "paragraph":
      case "html":
        break;
      default:
        if (block.type in counts) {
          counts[block.type as DocumentElementType] += 1;
        }
    }
    for (const inlines of inlineList(block)) {
      walkInlines(inlines, (inline) => {
        if (inline.type === "math") {
          counts.math += 1;
        }
      });
    }
  }
  counts.footnote = document.footnotes.length;
  return counts;
}

const WORD = /[\p{L}\p{N}]+/gu;

function words(text: string): string[] {
  return (text.toLowerCase().match(WORD) ?? []) as string[];
}

/** Words of the document in reading order, with TeX sources counted as text. */
export function documentWords(document: ReaderDocument): string[] {
  const parts: string[] = [];
  const addInlines = (inlines: ReaderInline[]) =>
    walkInlines(inlines, (inline) => {
      if (inline.type === "text" || inline.type === "code") {
        parts.push(inline.value);
      } else if (inline.type === "math") {
        parts.push(inline.tex ?? "");
      }
    });
  const visit = (block: ReaderBlock) => {
    if (block.type === "code") {
      parts.push(block.value, block.filename ?? "");
    }
    if (block.type === "math") {
      parts.push(block.tex ?? "");
    }
    if (block.type === "linkCard") {
      parts.push(block.title ?? "", block.description ?? "", block.siteName ?? "");
    }
    if (block.type === "audio") {
      parts.push(block.title ?? "");
    }
    for (const inlines of inlineList(block)) {
      addInlines(inlines);
      parts.push(" ");
    }
    if (block.type === "mediaText" || block.type === "paragraph") {
      parts.push(" ");
    }
  };
  // Block boundaries need separators so adjacent paragraphs do not fuse into one token.
  const visitAll = (blocks: ReaderBlock[]) =>
    walk(blocks, (block) => {
      visit(block);
      parts.push(" ");
    });
  visitAll(document.blocks);
  for (const footnote of document.footnotes) {
    visitAll(footnote.children);
  }
  return words(parts.join(" "));
}

/**
 * Words of the sanitized HTML body, minus prerendered math, the fallback link and quoted post
 * inside an embed figure (the embed-snapshot job owns that text), and a leading heading that
 * repeats the title.
 */
export function htmlWords(html: string, title: string): string[] {
  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`).window;
  for (const element of Array.from(document.body.querySelectorAll("math, .katex, script, style"))) {
    element.remove();
  }
  for (const embed of Array.from(document.body.querySelectorAll("figure[data-kyomi-embed]"))) {
    for (const child of Array.from(embed.children)) {
      if (child.tagName !== "FIGCAPTION") {
        child.remove();
      }
    }
  }
  // Footnote markers are references in the document, not text.
  for (const link of Array.from(document.body.querySelectorAll("a[href^='#']"))) {
    if (/^\[?\d{1,3}\]?$/.test(link.textContent?.trim() ?? "")) {
      (link.parentElement?.tagName === "SUP" ? link.parentElement : link).remove();
    }
  }
  // textContent fuses neighbours ("Region" + "Revenue"); give block boundaries a separator.
  for (const element of Array.from(
    document.body.querySelectorAll(
      "p, div, li, td, th, h1, h2, h3, h4, h5, h6, br, figcaption, summary, dt, dd, tr, pre",
    ),
  )) {
    element.prepend(document.createTextNode(" "));
    element.append(document.createTextNode(" "));
  }
  const first = document.body.querySelector("h1, h2, h3, h4, h5, h6");
  const normalized = (value: string) => words(value).join(" ");
  if (first && normalized(first.textContent ?? "") === normalized(title)) {
    first.remove();
  }
  return words(document.body.textContent ?? "");
}

function multisetRecall(source: string[], target: string[]): number {
  if (source.length === 0) {
    return 1;
  }
  const available = new Map<string, number>();
  for (const word of target) {
    available.set(word, (available.get(word) ?? 0) + 1);
  }
  let found = 0;
  for (const word of source) {
    const remaining = available.get(word) ?? 0;
    if (remaining > 0) {
      available.set(word, remaining - 1);
      found += 1;
    }
  }
  return found / source.length;
}

function lcsLength(a: string[], b: string[]): number {
  let previous = new Uint32Array(b.length + 1);
  let current = new Uint32Array(b.length + 1);
  for (const wordA of a) {
    for (let j = 1; j <= b.length; j += 1) {
      current[j] =
        wordA === b[j - 1] ? previous[j - 1]! + 1 : Math.max(previous[j]!, current[j - 1]!);
    }
    [previous, current] = [current, previous];
  }
  return previous[b.length]!;
}

const round = (value: number) => Math.round(value * 10_000) / 10_000;

export function scoreDocument(
  html: string,
  document: ReaderDocument | null,
  warnings: string[],
  title: string,
  expectation: DocumentExpectation,
): DocumentFixtureReport {
  const source = htmlWords(html, title);
  if (!document) {
    return {
      valid: false,
      warnings,
      words: source.length,
      textRecall: 0,
      order: 0,
      elements: {},
      htmlBlocks: 0,
    };
  }
  const target = documentWords(document);
  const counts = documentElementCounts(document);
  const elements: DocumentFixtureReport["elements"] = {};
  for (const [type, expected] of Object.entries(expectation.elements)) {
    elements[type as DocumentElementType] = {
      expected,
      actual: counts[type as DocumentElementType],
    };
  }
  return {
    valid: true,
    warnings,
    words: source.length,
    textRecall: round(multisetRecall(source, target)),
    order: round(source.length === 0 ? 1 : lcsLength(source, target) / source.length),
    elements,
    htmlBlocks: document.diagnostics.htmlBlocks,
  };
}

export function buildDocumentReport(
  compilerVersion: string,
  documentVersion: number,
  fixtures: Record<string, DocumentFixtureReport>,
): DocumentCorpusReport {
  const entries = Object.values(fixtures);
  const totalWords = entries.reduce((sum, entry) => sum + entry.words, 0);
  const perType: Partial<Record<DocumentElementType, { expected: number; actual: number }>> = {};
  for (const entry of entries) {
    for (const [type, { expected, actual }] of Object.entries(entry.elements)) {
      const total = (perType[type as DocumentElementType] ??= { expected: 0, actual: 0 });
      total.expected += expected;
      total.actual += Math.min(actual, expected);
    }
  }
  const elements = Object.fromEntries(
    Object.entries(perType)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, { expected, actual }]) => [
        type,
        { expected, actual, recall: round(expected === 0 ? 1 : actual / expected) },
      ]),
  );
  const expectedTotal = Object.values(perType).reduce((sum, entry) => sum + entry.expected, 0);
  const actualTotal = Object.values(perType).reduce((sum, entry) => sum + entry.actual, 0);
  return {
    compilerVersion,
    documentVersion,
    summary: {
      fixtures: entries.length,
      valid: entries.filter((entry) => entry.valid).length,
      htmlBlocks: entries.reduce((sum, entry) => sum + entry.htmlBlocks, 0),
      textRecall: round(
        totalWords === 0
          ? 1
          : entries.reduce((sum, entry) => sum + entry.textRecall * entry.words, 0) / totalWords,
      ),
      order: round(
        totalWords === 0
          ? 1
          : entries.reduce((sum, entry) => sum + entry.order * entry.words, 0) / totalWords,
      ),
      elementRecall: round(expectedTotal === 0 ? 1 : actualTotal / expectedTotal),
      elements,
    },
    fixtures,
  };
}

/** Stable snapshot form: KaTeX markup and highlight tokens are summarised by size and hash. */
export function stableDocument(document: ReaderDocument): unknown {
  return JSON.parse(
    JSON.stringify(document, (key, value: unknown) => {
      if (key === "rendered" && typeof value === "string") {
        return `katex:${value.length}:${Bun.hash(value).toString(16)}`;
      }
      if (key === "highlight" && value && typeof value === "object") {
        const highlight = value as { engine: string; styles: unknown[]; lines: unknown[][] };
        return `${highlight.engine} styles=${highlight.styles.length} lines=${highlight.lines.length} hash=${Bun.hash(JSON.stringify(value)).toString(16)}`;
      }
      return value;
    }),
  );
}
