#!/usr/bin/env bun
// Math accuracy eval. Runs the real article compiler over a corpus and reports, per article and
// in total, how every formula came out: delimiter detection, KaTeX render, MathJax SVG, and
// residual delimiters left in prose (possible false negatives). It needs no database: the corpus
// is an NDJSON file of `{ "id": string, "body": string, "format"?: "html" | "markdown" | "text" }`
// rows (export from any store), and a built-in set of parity formulas always runs.
//
//   bun scripts/evals/math/run-eval.ts --corpus corpus.ndjson [--out report.json] [--limit N]
//   bun scripts/evals/math/run-eval.ts            # parity formulas only
//
// Precision over recall: a wrong formula is worse than TeX source, so the report separates
// "rendered" (KaTeX ok), "svg" (native inline ok) and "tex-only" (honest fallback).
import { readFileSync, writeFileSync } from "node:fs";
import { compileArticleDocument } from "@kyomi/ingest/document";
import { PARITY_FORMULAS } from "./formulas";

type Row = { id: string; body: string; format?: "html" | "markdown" | "text" };
type MathNode = {
  type: "math";
  tex?: string;
  rendered?: string;
  svg?: string;
  mathml?: string;
};

type Found = { node: MathNode; display: boolean; where: string };

/** Blocks are display math; inline children are inline. */
function walk(blocks: unknown[], out: Found[]): void {
  const visit = (value: unknown, inBlockList: boolean) => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item, inBlockList);
      return;
    }
    if (!value || typeof value !== "object") return;
    const node = value as Record<string, unknown>;
    if (node.type === "math") {
      out.push({ node: node as MathNode, display: inBlockList, where: "" });
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      if (key === "type") continue;
      // `children` of a paragraph/heading are inlines; everything else nests blocks.
      const inline = key === "children" && ["paragraph", "heading"].includes(String(node.type));
      visit(child, inline ? false : inBlockList || node.type === undefined);
    }
  };
  for (const block of blocks) visit(block, true);
}

const RESIDUAL = [
  ["$$", /\$\$/],
  ["\\(", /\\\(/],
  ["\\[", /\\\[/],
  ["\\begin", /\\begin\{/],
  ["$x$", /(?<![\\$])\$(?=[^\s$])[^$\n]{1,200}?(?<=[^\s\\])\$(?![\d$])/],
] as const;

function proseText(value: unknown, out: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) proseText(item, out);
    return;
  }
  if (!value || typeof value !== "object") return;
  const node = value as Record<string, unknown>;
  if (node.type === "code" || node.type === "math") return;
  if (node.type === "text" && typeof node.value === "string") out.push(node.value);
  for (const [key, child] of Object.entries(node)) {
    if (key !== "type" && key !== "value") proseText(child, out);
  }
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

type Totals = {
  articles: number;
  articlesWithMath: number;
  inline: number;
  block: number;
  /** TeX the compiler kept but KaTeX rejected (honest fallback: shown as TeX source). */
  texOnlyFailedKatex: number;
  /** Inline formulas KaTeX rendered but that have no SVG (native falls back to TeX or Unicode). */
  noSvgInline: number;
  mathmlOnly: number;
  mathmlOnlyWithSvg: number;
  residual: Record<string, number>;
  articlesNull: number;
};

const totals: Totals = {
  articles: 0,
  articlesWithMath: 0,
  inline: 0,
  block: 0,
  texOnlyFailedKatex: 0,
  noSvgInline: 0,
  mathmlOnly: 0,
  mathmlOnlyWithSvg: 0,
  residual: {},
  articlesNull: 0,
};

const details: Record<string, unknown>[] = [];
const rows: Row[] = [];
const corpus = arg("corpus");
if (corpus) {
  for (const line of readFileSync(corpus, "utf8").split("\n")) {
    if (line.trim()) rows.push(JSON.parse(line) as Row);
  }
}
const limit = Number(arg("limit") ?? Infinity);

for (const row of rows.slice(0, limit)) {
  totals.articles += 1;
  const result = await compileArticleDocument({
    body: row.body,
    format: row.format ?? "html",
    origin: "feed_html",
  });
  if (!result.document) {
    totals.articlesNull += 1;
    continue;
  }
  const found: Found[] = [];
  walk(result.document.blocks as unknown[], found);
  for (const footnote of result.document.footnotes ?? []) {
    walk((footnote as { children: unknown[] }).children, found);
  }
  const prose: string[] = [];
  proseText(result.document.blocks, prose);
  const residual: string[] = [];
  for (const [label, pattern] of RESIDUAL) {
    if (prose.some((text) => pattern.test(text))) {
      residual.push(label);
      totals.residual[label] = (totals.residual[label] ?? 0) + 1;
    }
  }
  if (found.length > 0) totals.articlesWithMath += 1;
  const failures: string[] = [];
  for (const { node, display } of found) {
    if (display) totals.block += 1;
    else totals.inline += 1;
    if (node.tex && !node.rendered) {
      totals.texOnlyFailedKatex += 1;
      failures.push(`katex:${node.tex.slice(0, 120)}`);
    }
    // A source KaTeX rejected never gets an SVG on purpose, so it is not an SVG gap.
    if (!display && node.tex && node.rendered && !node.svg) {
      totals.noSvgInline += 1;
      failures.push(`svg:${node.tex.slice(0, 120)}`);
    }
    if (!node.tex && node.mathml) {
      totals.mathmlOnly += 1;
      if (node.svg) totals.mathmlOnlyWithSvg += 1;
    }
  }
  if (found.length > 0 || residual.length > 0) {
    details.push({
      id: row.id,
      math: found.map(({ node, display }) => ({
        display,
        tex: node.tex?.slice(0, 160),
        rendered: Boolean(node.rendered),
        svg: Boolean(node.svg),
        mathmlOnly: !node.tex && Boolean(node.mathml),
      })),
      residual,
      failures,
    });
  }
}

// Parity: every formula must render in KaTeX and MathJax, or fail in both (an honest fallback).
const parityResults: { tex: string; katex: boolean; svg: boolean; note?: string }[] = [];
for (const entry of PARITY_FORMULAS) {
  const result = await compileArticleDocument({
    body: `<p>x \\(${entry.tex}\\) y</p>`,
    origin: "feed_html",
  });
  const found: Found[] = [];
  walk((result.document?.blocks ?? []) as unknown[], found);
  const node = found[0]?.node;
  parityResults.push({
    tex: entry.tex,
    katex: Boolean(node?.rendered),
    svg: Boolean(node?.svg),
    note: entry.note,
  });
}
const gaps = parityResults.filter((item) => item.katex && !item.svg);
const overdraws = parityResults.filter((item) => !item.katex && item.svg);

const report = { totals, parity: { total: parityResults.length, gaps, overdraws }, details };
const out = arg("out");
if (out) writeFileSync(out, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      totals,
      parityTotal: parityResults.length,
      // KaTeX draws these but native inline SVG does not (falls back to TeX source).
      parityGaps: gaps.map((item) => item.tex),
      // The reverse must be empty: native must never draw what KaTeX rejects.
      parityOverdraws: overdraws.map((item) => item.tex),
    },
    null,
    2,
  ),
);
