#!/usr/bin/env bun
// Builds packages/reader/src/web/katex-offline.css: katex.min.css with every font inlined as a
// woff2 data URI. The mobile math island (a WebView exported by Expo) loads its stylesheet from
// the bundle, and Metro leaves `url(fonts/KaTeX_*.woff2)` untouched without copying the font
// files, so the stock stylesheet cannot resolve its fonts offline. Re-run after a KaTeX upgrade:
//
//   bun scripts/katex/offline-css.ts
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(join(import.meta.dir, "../../packages/reader/package.json"));
const dist = dirname(require.resolve("katex/dist/katex.min.css"));
const css = readFileSync(join(dist, "katex.min.css"), "utf8");

const inlined = css.replace(
  /src:url\((fonts\/[^)]+?\.woff2)\) format\("woff2"\)(?:,url\([^)]+\) format\("[^"]+"\))*/g,
  (_match, path: string) => {
    const base64 = readFileSync(join(dist, path)).toString("base64");
    return `src:url(data:font/woff2;base64,${base64}) format("woff2")`;
  },
);
if (/url\(fonts\//.test(inlined)) {
  throw new Error("katex.min.css still references font files");
}
const target = join(import.meta.dir, "../../packages/reader/src/web/katex-offline.css");
writeFileSync(target, inlined);
console.log(`${target}: ${inlined.length} bytes`);
