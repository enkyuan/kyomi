import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const root = join(import.meta.dir, "../../../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const require = createRequire(join(root, "packages/reader/package.json"));

describe("KaTeX stylesheet for the math island", () => {
  const offline = read("packages/reader/src/web/katex-offline.css");
  const stock = readFileSync(require.resolve("katex/dist/katex.min.css"), "utf8");

  test("inlines every font, because the exported WebView bundle does not ship font files", () => {
    expect(offline).not.toMatch(/url\((?!data:)/);
    const faces = (css: string) => css.match(/@font-face\{[^}]*\}/g) ?? [];
    expect(faces(offline)).toHaveLength(faces(stock).length);
    for (const face of faces(offline)) {
      expect(face).toMatch(
        /src:url\(data:font\/woff2;base64,[A-Za-z0-9+/=]{1000,}\) format\("woff2"\)\}$/,
      );
    }
  });

  test("is the stock stylesheet apart from the font sources (run scripts/katex/offline-css.ts after a KaTeX upgrade)", () => {
    const strip = (css: string) => css.replace(/src:url\([^)]*\)[^}]*\}/g, "src:*}");
    expect(strip(offline)).toBe(strip(stock));
  });

  test("the island loads it instead of the stock stylesheet and keeps display margins out of the measured body", () => {
    const island = read("apps/mobile/src/modules/reader/components/html-island.dom.tsx");
    expect(island).toContain('import "@kyomi/reader/web/katex-offline.css";');
    expect(island).not.toContain("katex/dist/katex.min.css");
    expect(island).toContain('display: "flow-root"');
    expect(island).toContain(".katex-display{margin:0}");
  });
});
