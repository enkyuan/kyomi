/**
 * Offline accuracy audit for compiled code blocks. It needs no database: it reads a JSONL export of
 * the stored blocks (one `{id, col, block}` object per line) and re-runs the compiler's
 * highlighter over them.
 *
 *   docker exec kyomi-postgres psql -U postgres -d kyomi -Atc "select jsonb_build_object('id', f.id::text,
 *     'col', 'content_document', 'block', b)::text from feed_items f, jsonb_path_query(f.content_document,
 *     'lax $.**.blocks[*] ? (@.type==\"code\")') b" > code.jsonl
 *   bun scripts/evals/highlight/run-eval.ts code.jsonl [--reverse]
 *
 * Exit code 1 when a hard defect is found. The reported digest is stable across call order, so
 * comparing a normal run with `--reverse` checks that tokenization does not depend on it.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  ALIASES,
  auditStored,
  FIXTURES,
  fingerprint,
  highlightCode,
  MAX_HIGHLIGHT_CHARS,
  MAX_HIGHLIGHT_LINES,
  plainReason,
  type StoredCodeBlock,
} from "./audit";
import { lookupLanguage } from "../../../packages/ingest/src/document/code-language";

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error("usage: bun scripts/evals/highlight/run-eval.ts <code.jsonl> [--reverse]");
  process.exit(2);
}

// First, before any language is loaded: an id that is not a bundled language must not break the
// engine for every later call.
const poison = await highlightCode("x", "constructor");
const afterPoison = await highlightCode("x = 1\n", "jsonc");

const seen = new Set<string>();
let blocks: { id: string; block: StoredCodeBlock }[] = [];
for (const line of readFileSync(file, "utf8").split("\n")) {
  if (!line.trim()) continue;
  const row = JSON.parse(line) as { id: string; col: string; block: StoredCodeBlock };
  const key = `${row.id}|${row.col}|${row.block.value}`;
  if (seen.has(key)) continue;
  seen.add(key);
  blocks.push({ id: row.id, block: row.block });
}
if (flags.includes("--reverse")) blocks = blocks.reverse();

const count = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
const sorted = (map: Map<string, number>) => [...map].sort((a, b) => b[1] - a[1]);

let hardFailures = 0;
const stored = { total: blocks.length, withLanguage: 0, highlighted: 0, crlf: 0, tabs: 0 };
const issues = new Map<string, number>();
const plain = new Map<string, number>();
const plainLanguages = new Map<string, number>();
const examples: string[] = [];

for (const { id, block } of blocks) {
  if (block.language) stored.withLanguage++;
  if (block.highlight) stored.highlighted++;
  if (block.value.includes("\r")) stored.crlf++;
  if (block.value.includes("\t")) stored.tabs++;
  for (const issue of auditStored(block)) {
    count(issues, issue);
    if (examples.length < 10) examples.push(`${issue} ${id}`);
  }
  const reason = plainReason(block);
  if (reason) {
    count(plain, reason);
    count(plainLanguages, `${reason}:${block.language}`);
  }
}

// Recompute with the current highlighter: first pass is cold, second pass hits warm state.
const recomputed = { match: 0, differs: 0, nowHighlighted: 0, nowPlain: 0, throws: 0 };
const cold: string[] = [];
const prints: string[] = [];
for (const { block } of blocks) {
  if (!block.language) {
    cold.push("");
    continue;
  }
  let result = null;
  try {
    result = await highlightCode(block.value, block.language);
  } catch {
    recomputed.throws++;
  }
  const print = fingerprint(result);
  cold.push(print);
  prints.push(`${block.language}\n${block.value}\n${print}`);
  const before = fingerprint(block.highlight ?? null);
  if (before === print) recomputed.match++;
  else {
    recomputed.differs++;
    if (!block.highlight && result) recomputed.nowHighlighted++;
    if (block.highlight && !result) recomputed.nowPlain++;
  }
  if (result && auditStored({ ...block, highlight: result }).length) hardFailures++;
}
let unstable = 0;
for (const [index, { block }] of blocks.entries()) {
  if (!block.language) continue;
  const again = fingerprint(await highlightCode(block.value, block.language));
  if (again !== cold[index]) unstable++;
}

const fixtureFailures: string[] = [];
for (const fixture of FIXTURES) {
  const result = await highlightCode(fixture.value, fixture.language);
  if (!result) {
    console.log(`  fixture ${fixture.name} (${fixture.language}): plain`);
    continue;
  }
  const bad = auditStored({ value: fixture.value, language: fixture.language, highlight: result });
  if (bad.length) fixtureFailures.push(`${fixture.name}: ${bad.join(",")}`);
}
const aliasPlain: string[] = [];
for (const alias of ALIASES) {
  const id = lookupLanguage(alias)?.id;
  const result = id ? await highlightCode("x = 1\n", id) : null;
  if (!result) aliasPlain.push(`${alias}->${id ?? "unresolved"}`);
}
const caps = {
  chars: await highlightCode("a".repeat(MAX_HIGHLIGHT_CHARS + 1), "javascript"),
  lines: await highlightCode("a\n".repeat(MAX_HIGHLIGHT_LINES), "javascript"),
  atCharCap: await highlightCode(
    Array.from({ length: 30 }, () => "a".repeat(1000))
      .join("\n")
      .slice(0, MAX_HIGHLIGHT_CHARS),
    "javascript",
  ),
};
console.log("corpus", stored);
console.log("stored defects", Object.fromEntries(issues), examples);
console.log("language but plain", Object.fromEntries(plain), sorted(plainLanguages).slice(0, 15));
console.log("recomputed vs stored", recomputed, "unstable-on-second-call", unstable);
console.log("invalid recomputed results", hardFailures);
console.log("fixture failures", fixtureFailures);
console.log("aliases left plain", aliasPlain);
console.log("caps", {
  overChars: caps.chars === null,
  overLines: caps.lines === null,
  atCharCapHighlighted: caps.atCharCap !== null,
});
console.log("non-bundled id does not poison engine", poison === null && afterPoison !== null);
console.log("digest", createHash("sha256").update(prints.sort().join("\u0000")).digest("hex"));
const failed =
  hardFailures > 0 ||
  fixtureFailures.length > 0 ||
  issues.size > 0 ||
  unstable > 0 ||
  recomputed.throws > 0 ||
  aliasPlain.length > 0 ||
  caps.chars !== null ||
  caps.lines !== null ||
  afterPoison === null;
process.exit(failed ? 1 : 0);
