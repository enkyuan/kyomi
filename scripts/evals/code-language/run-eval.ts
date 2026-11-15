#!/usr/bin/env bun
// Code-block language classification eval. Runs the real compiler lowering and the real
// classifier (`classifyCode`) over a local corpus of article bodies, with the author's language
// hint and filename stripped from the block under test, and scores the result against that
// hint. It needs no database: export the corpus once with the query below, then run
//
//   docker exec kyomi-postgres psql -U postgres -d kyomi -Atc \
//     "select json_build_object('id', id, 'body', coalesce(content_raw, content)) \
//      from feed_items where coalesce(content_raw, content) like '%<pre%'" > corpus.jsonl
//   bun scripts/evals/code-language/run-eval.ts --corpus corpus.jsonl [--sample 60] [--seed 1]
//
// Ground truth is every block whose language came from an explicit hint or a filename, plus
// explicit plain-text hints (truth "none"). Shebang blocks are skipped: the shebang is content,
// not a strippable hint. Each target block is scored leave-one-out: the article's other blocks
// keep their hints, so article-level priors are exercised as they are in the compiler.
// Precision matters more than recall; a wrong label or colour is worse than plain text.

import { readFileSync, writeFileSync } from "node:fs";
import {
  compileArticleRoot,
  createDraft,
  createLowerContext,
  lowerHtml,
} from "@kyomi/worker/document";
import {
  classifyCode,
  collectCodeEntries,
  priorFrom,
} from "../../../packages/worker/src/document/code-classify";
import { resolveLanguage } from "../../../packages/worker/src/document/code-language";
import { ARTICLE_DOCUMENT_PASSES } from "@kyomi/worker/document";

type Row = { id: string; f?: string; body?: string; b?: string };

const args = process.argv.slice(2);
const flag = (name: string, fallback?: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : fallback;
};
const corpusPath = flag("corpus");
if (!corpusPath) {
  console.error("usage: run-eval.ts --corpus <jsonl> [--sample N] [--seed N] [--json out.json]");
  process.exit(2);
}
const SAMPLE = Number(flag("sample", "60"));
let seed = Number(flag("seed", "1"));
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

/** Languages whose colouring is visually interchangeable, for the lenient "family" score. */
const FAMILY: Record<string, string> = {
  javascript: "js",
  typescript: "js",
  jsx: "js",
  tsx: "js",
  c: "c",
  cpp: "c",
  "objective-c": "c",
  shellscript: "sh",
  shellsession: "sh",
  json: "json",
  jsonc: "json",
  json5: "json",
  html: "html",
  xml: "html",
  yaml: "yaml",
  toml: "toml",
  ini: "toml",
};
const family = (id: string) => FAMILY[id] ?? id;

type Prediction = { label: string | null; colour: string | null; source: string };
type Case = { id: string; value: string; truth: string; predicted: Prediction; heading?: string };
type Unhinted = { id: string; value: string; predicted: Prediction; heading?: string };

const cases: Case[] = [];
const unhinted: Unhinted[] = [];
const seen = new Set<string>();
let articles = 0;
let blocks = 0;
let shebang = 0;

for (const line of readFileSync(corpusPath, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const row = JSON.parse(line) as Row;
  const body = row.body ?? row.b;
  if (!body) continue;
  let draft;
  try {
    const { root, context } = compileArticleRoot(body, { baseUrl: null, generator: null });
    const ctx = createLowerContext();
    draft = createDraft({
      source: { format: "html", origin: "feed_html", baseUrl: context.baseUrl },
      compiler: { version: "eval", sanitizerVersion: "eval" } as never,
      meta: {
        title: null,
        subtitle: null,
        authors: [],
        siteName: null,
        language: null,
        direction: "auto",
        publishedAt: null,
        updatedAt: null,
        wordCount: 0,
        readingMinutes: 0,
        leadImage: null,
      },
      blocks: lowerHtml(root, ctx),
      defs: ctx.defs,
      hints: ctx.hints,
    });
    for (const pass of ARTICLE_DOCUMENT_PASSES) {
      if (pass.name === "code") break;
      await pass.run(draft);
    }
  } catch {
    continue;
  }
  articles += 1;
  const entries = collectCodeEntries(draft.blocks);
  const resolved = entries.map(({ block }) =>
    resolveLanguage(draft.hints.get(block)?.codeLanguage, block.filename, block.value),
  );
  for (const [index, entry] of entries.entries()) {
    blocks += 1;
    const truth = resolved[index]!;
    const hasTruth = truth.source === "explicit" || truth.source === "filename";
    if (truth.source === "shebang") shebang += 1;
    const prior = priorFrom(
      resolved.flatMap((other, at) =>
        at !== index &&
        (other.source === "explicit" || other.source === "filename") &&
        other.language
          ? [other.language.id]
          : [],
      ),
    );
    const result = await classifyCode({
      value: entry.block.value,
      hint: undefined,
      filename: undefined,
      previous: entry.previous,
      next: entry.next,
      heading: entry.heading,
      prior,
    });
    const predicted: Prediction = {
      label: result.language?.id ?? null,
      colour: result.colour?.id ?? null,
      source: result.source,
    };
    const key = entry.block.value;
    if (seen.has(key)) continue;
    seen.add(key);
    if (hasTruth) {
      cases.push({
        id: row.id,
        value: key,
        truth: truth.language?.id ?? "none",
        predicted,
        ...(entry.heading ? { heading: entry.heading } : {}),
      });
    } else if (truth.source === "none") {
      unhinted.push({
        id: row.id,
        value: key,
        predicted,
        ...(entry.heading ? { heading: entry.heading } : {}),
      });
    }
  }
}

const pct = (n: number, d: number) =>
  d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}% (${n}/${d})`;
const langCases = cases.filter((c) => c.truth !== "none");
const plainCases = cases.filter((c) => c.truth === "none");
const labelled = langCases.filter((c) => c.predicted.label);
const colourOnly = langCases.filter((c) => !c.predicted.label && c.predicted.colour);
const labelCorrect = labelled.filter((c) => c.predicted.label === c.truth);
const colourCorrect = colourOnly.filter((c) => c.predicted.colour === c.truth);
const colourFamily = colourOnly.filter((c) => family(c.predicted.colour!) === family(c.truth));
const plainFalse = plainCases.filter((c) => c.predicted.label || c.predicted.colour);

console.log(`articles ${articles}  code blocks ${blocks}  shebang (skipped) ${shebang}`);
console.log(
  `ground truth (deduped by value): ${langCases.length} language, ${plainCases.length} plain`,
);
console.log(
  `coverage (labelled or coloured):      ${pct(labelled.length + colourOnly.length, langCases.length)}`,
);
console.log(`labelled                              ${labelled.length}`);
console.log(`labelled precision (exact):           ${pct(labelCorrect.length, labelled.length)}`);
console.log(`colour-only                           ${colourOnly.length}`);
console.log(
  `colour-only precision (exact):        ${pct(colourCorrect.length, colourOnly.length)}`,
);
console.log(`colour-only precision (family):       ${pct(colourFamily.length, colourOnly.length)}`);
console.log(`false positives on ground-truth plain: ${pct(plainFalse.length, plainCases.length)}`);

const confusion = new Map<string, number>();
for (const c of langCases) {
  const shown = c.predicted.label ?? c.predicted.colour;
  if (shown !== c.truth) {
    const k = `${c.truth} -> ${shown ?? "plain"}${c.predicted.label ? " [label]" : ""}`;
    confusion.set(k, (confusion.get(k) ?? 0) + 1);
  }
}
console.log("\nconfusion (truth -> shown), errors and misses:");
for (const [k, n] of [...confusion].sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(n).padStart(4)}  ${k}`);

const perLanguage = new Map<string, { n: number; hit: number; wrong: number }>();
for (const c of langCases) {
  const row = perLanguage.get(c.truth) ?? { n: 0, hit: 0, wrong: 0 };
  const shown = c.predicted.label ?? c.predicted.colour;
  row.n += 1;
  if (shown === c.truth) row.hit += 1;
  else if (shown) row.wrong += 1;
  perLanguage.set(c.truth, row);
}
console.log("\nper language: n hit wrong");
for (const [k, v] of [...perLanguage].sort((a, b) => b[1].n - a[1].n))
  console.log(`  ${k.padEnd(14)} ${v.n} ${v.hit} ${v.wrong}`);

const wrongList = [
  ...labelled.filter((c) => c.predicted.label !== c.truth),
  ...colourOnly.filter((c) => c.predicted.colour !== c.truth),
  ...plainFalse,
];
console.log(`\nwrong predictions (${wrongList.length}):`);
for (const c of wrongList.slice(0, 40)) {
  console.log(`--- truth=${c.truth} shown=${c.predicted.label ?? c.predicted.colour} id=${c.id}`);
  console.log(c.value.split("\n").slice(0, 6).join("\n"));
}

const coloured = unhinted.filter((u) => u.predicted.colour || u.predicted.label);
console.log(
  `\nunhinted blocks: ${unhinted.length}, coloured ${coloured.length} (${pct(coloured.length, unhinted.length)})`,
);
const byColour = new Map<string, number>();
for (const u of coloured)
  byColour.set(
    u.predicted.label ?? u.predicted.colour!,
    (byColour.get(u.predicted.label ?? u.predicted.colour!) ?? 0) + 1,
  );
console.log(
  "  " +
    [...byColour]
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => `${k}:${n}`)
      .join(" "),
);

function pick<T>(list: T[], n: number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}
const sample = [
  ...pick(coloured, Math.ceil(SAMPLE * 0.6)),
  ...pick(
    unhinted.filter((u) => !u.predicted.colour && !u.predicted.label),
    Math.floor(SAMPLE * 0.4),
  ),
];
console.log(`\nunhinted sample (${sample.length}), for hand-checking:`);
for (const [i, u] of sample.entries()) {
  console.log(
    `\n=== #${i + 1} predicted=${u.predicted.label ?? u.predicted.colour ?? "PLAIN"}${u.heading ? `  heading="${u.heading.slice(0, 60)}"` : ""}`,
  );
  console.log(
    u.value
      .split("\n")
      .slice(0, 8)
      .map((l) => l.slice(0, 120))
      .join("\n"),
  );
}

const out = flag("json");
if (out) {
  writeFileSync(
    out,
    JSON.stringify({
      cases,
      unhinted: unhinted.map((u) => ({ ...u, value: u.value.slice(0, 2000) })),
    }),
  );
}
