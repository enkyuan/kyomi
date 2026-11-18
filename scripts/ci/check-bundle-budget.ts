import { Glob } from "bun";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { fail, section } from "./log";

// A ceiling on the web client's JavaScript, so a dependency or an import that quietly adds tens of
// kilobytes fails CI instead of showing up later as a slower first load. Sizes are gzip bytes of the
// built `assets/**/*.js`, which is what a browser downloads.
//
// Run after `bun run --cwd apps/web build` (wired into the same CI step, not a separate job).
// Raise a budget on purpose, in the same change that adds the weight, and say why in the commit.

const ROOT_DIR = join(import.meta.dir, "../..");
const ASSETS_DIR = join(ROOT_DIR, "apps/web/.output/public/assets");

/** All client JavaScript together. About 726 kB when the budget was set. */
const TOTAL_BUDGET_BYTES = 800_000;
/** The largest single chunk. The PostHog vendor chunk, about 86 kB, was the largest when it was set. */
const LARGEST_CHUNK_BUDGET_BYTES = 100_000;

const formatKb = (bytes: number) => `${(bytes / 1000).toFixed(1)} kB`;

section("Checking the built client JavaScript against the bundle budget");

const chunks: { file: string; gzipBytes: number }[] = [];
for await (const file of new Glob("**/*.js").scan({ cwd: ASSETS_DIR, absolute: false })) {
  const bytes = new Uint8Array(await Bun.file(join(ASSETS_DIR, file)).arrayBuffer());
  chunks.push({ file, gzipBytes: gzipSync(bytes).length });
}

if (chunks.length === 0) {
  fail(
    `No built JavaScript found under ${ASSETS_DIR}. Run 'bun run --cwd apps/web build' before this check.`,
  );
}

chunks.sort((a, b) => b.gzipBytes - a.gzipBytes);
const total = chunks.reduce((sum, chunk) => sum + chunk.gzipBytes, 0);
const largest = chunks[0]!;

console.log(
  `Total: ${formatKb(total)} gzip across ${chunks.length} chunks (budget ${formatKb(TOTAL_BUDGET_BYTES)}).`,
);
console.log(
  `Largest: ${largest.file}, ${formatKb(largest.gzipBytes)} (budget ${formatKb(LARGEST_CHUNK_BUDGET_BYTES)}).`,
);

const failures: string[] = [];
if (total > TOTAL_BUDGET_BYTES) {
  failures.push(
    `Client JavaScript is ${formatKb(total)} gzip, over the ${formatKb(TOTAL_BUDGET_BYTES)} budget. Largest chunks:\n` +
      chunks
        .slice(0, 5)
        .map((chunk) => `  ${formatKb(chunk.gzipBytes)}  ${chunk.file}`)
        .join("\n"),
  );
}
if (largest.gzipBytes > LARGEST_CHUNK_BUDGET_BYTES) {
  failures.push(
    `${largest.file} is ${formatKb(largest.gzipBytes)} gzip, over the ${formatKb(LARGEST_CHUNK_BUDGET_BYTES)} single-chunk budget.`,
  );
}

if (failures.length > 0) {
  fail(failures.join("\n"));
}
