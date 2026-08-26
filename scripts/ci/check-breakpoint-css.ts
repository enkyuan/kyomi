import { Glob } from "bun";
import { join } from "node:path";
import { fail, section } from "./log";

// Guards against `packages/ui/src/styles/theme.css`'s `--breakpoint-*` tokens drifting from
// `BREAKPOINTS` in `packages/ui/src/hooks/use-media-query.ts` again. This is a generated-CSS
// property, not component behavior, so it's a build-output grep rather than a Vitest test —
// JSDOM never evaluates CSS media queries, so it can't verify this at all.
//
// Run after `bun run --cwd apps/web build` (wired into the same CI step, not a separate job).

const ROOT_DIR = join(import.meta.dir, "../..");
const WEB_OUTPUT_DIR = join(ROOT_DIR, "apps/web/.output");

const REQUIRED_MEDIA_QUERIES = [
  "@media (min-width: 800px)", // md — must match useMediaQuery's BREAKPOINTS.md, not Tailwind's 768px default
  "@media (min-width: 1600px)", // 3xl
  "@media (min-width: 2000px)", // 4xl
];

section("Checking built CSS for the aligned breakpoint tokens");

const glob = new Glob("**/*.css");
let cssContent = "";
let fileCount = 0;

for await (const relativePath of glob.scan({ cwd: WEB_OUTPUT_DIR, absolute: false })) {
  fileCount += 1;
  cssContent += await Bun.file(join(WEB_OUTPUT_DIR, relativePath)).text();
}

if (fileCount === 0) {
  fail(
    `No built CSS found under ${WEB_OUTPUT_DIR}. Run 'bun run --cwd apps/web build' before this check.`,
  );
}

const missing = REQUIRED_MEDIA_QUERIES.filter((query) => !cssContent.includes(query));

if (missing.length > 0) {
  fail(
    `Built CSS is missing expected breakpoint(s): ${missing.join(", ")}. ` +
      "Check the --breakpoint-* tokens in packages/ui/src/styles/theme.css against BREAKPOINTS in " +
      "packages/ui/src/hooks/use-media-query.ts — they must stay in sync.",
  );
}

console.log(`Found all ${REQUIRED_MEDIA_QUERIES.length} expected breakpoints in built CSS.`);
