/**
 * Renders every empty-state illustration, using the real scene code, to static HTML for review
 * without a simulator: `bun scripts/empty-state-gallery.tsx <outDir> [sceneName...]`.
 * react-native-svg and react-native are swapped for DOM equivalents before the scenes load.
 */
import { createElement } from "react";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { plugin } from "bun";
import { renderToStaticMarkup } from "react-dom/server";

const scheme = { current: "dark" };

plugin({
  name: "empty-state-gallery-shims",
  setup(build) {
    const tag = (name: string) =>
      function Tag({
        accessibilityElementsHidden: _a,
        importantForAccessibility: _i,
        ...props
      }: Record<string, unknown>) {
        return createElement(name, props);
      };
    build.module("react-native-svg", () => ({
      exports: {
        Defs: tag("defs"),
        G: tag("g"),
        LinearGradient: tag("linearGradient"),
        Path: tag("path"),
        Rect: tag("rect"),
        Stop: tag("stop"),
        Svg: tag("svg"),
        Circle: tag("circle"),
        Ellipse: tag("ellipse"),
        Line: tag("line"),
        ClipPath: tag("clipPath"),
        Mask: tag("mask"),
        RadialGradient: tag("radialGradient"),
        Polygon: tag("polygon"),
        Polyline: tag("polyline"),
        Filter: tag("filter"),
      },
      loader: "object",
    }));
    build.module("react-native", () => ({
      exports: { useColorScheme: () => scheme.current },
      loader: "object",
    }));
  },
});

const [outDir = "empty-state-gallery", ...only] = process.argv.slice(2);
const { EmptyStateIcon } = await import("../src/components/icons/empty-state");
const { EMPTY_STATES } = await import("../src/modules/inbox/components/empty-state-content");

const names = (Object.keys(EMPTY_STATES) as (keyof typeof EMPTY_STATES)[]).filter(
  (name) => only.length === 0 || only.includes(name),
);

let cardCount = 0;

function card(name: keyof typeof EMPTY_STATES, mode: "dark" | "light") {
  scheme.current = mode;
  cardCount += 1;
  // useId repeats across separate renders, and duplicate gradient ids resolve to the first in the page.
  const art = renderToStaticMarkup(
    createElement(EmptyStateIcon, { scene: name, size: 176 }),
  ).replace(/(empty-state-(?:back|front|stroke)-[A-Za-z0-9_]+)/g, `$1-${cardCount}`);
  const { header, description } = EMPTY_STATES[name];
  const dark = mode === "dark";
  return `<div class="card ${mode}"><div class="art">${art}</div><h3>${header}</h3><p>${description.replaceAll("\n", "<br>")}</p><code>${name}</code></div>`;
}

const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#888;font-family:-apple-system,Helvetica,Arial,sans-serif;padding:24px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;width:1328px}
.pair{display:grid;grid-template-columns:1fr 1fr}
.card{height:330px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;position:relative}
.card.light{background:#fff;color:#000}.card.dark{background:#0a0a0a;color:#fff}
.art{margin-bottom:20px;line-height:0}
h3{margin:0 0 8px;font-size:22px;font-weight:700;letter-spacing:-.01em}
p{margin:0;font-size:15px;line-height:20px;text-align:center;color:#8a8a8a}
code{position:absolute;left:10px;bottom:8px;font-size:10px;color:#8a8a8a}
</style><div class="grid">${names
  .map((name) => `<div class="pair">${card(name, "light")}${card(name, "dark")}</div>`)
  .join("")}</div>`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "index.html"), html);
console.log(`${names.length} scenes -> ${join(outDir, "index.html")}`);
