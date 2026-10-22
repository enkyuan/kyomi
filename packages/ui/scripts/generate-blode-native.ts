/**
 * Generates `src/icons/blode-native.ts`: renderer-neutral path data for the Blode icons that
 * native (React Native and SwiftUI) surfaces draw. Blode ships DOM-only React components, so
 * the geometry is read from their rendered SVG instead of importing them into native code.
 *
 * Run with `bun run icons:native` after changing `ICONS`.
 */
import * as Blode from "blode-icons-react";
import { readFileSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** Blode export name, without the `Icon` suffix, for every icon native code uses. */
const ICONS = [
  "ArrowShareRight",
  "Bookmark",
  "BookmarkFilled",
  "Brain",
  "ChevronGrabberVertical",
  "ChevronsUpDown",
  "Clock",
  "Ellipsis",
  "FileArrowLeftIn",
  "FilterAsc",
  "FilterAscFilled",
  "History",
  "HistoryFilled",
  "Inbox",
  "InboxFilled",
  "Lock",
  "MagnifyingGlass",
  "MessageCircle",
  "PageTextSearch",
  "Plus",
  "ReceiptBill",
  "Rss",
  "Search",
  "Text",
  "Toggle",
  "X",
] as const;

/**
 * Icons newer than (or revised since) the installed `blode-icons-react`, taken from Blode's own SVG
 * downloads in `scripts/svg`. Drop an entry once the package ships it and move it to `ICONS`.
 */
const SVG_FILES = {
  CompassPointer: "svg/compass-pointer.svg",
  CompassPointerFilled: "svg/compass-pointer-filled.svg",
  LayoutAlignBottom: "svg/layout-align-bottom.svg",
  LayoutAlignBottomFilled: "svg/layout-align-bottom-filled.svg",
} as const;

type GeneratedPath = {
  d: string;
  fillRule?: "evenodd";
  stroke?: { linecap?: "round"; linejoin?: "round" };
};

function attribute(source: string, name: string): string | undefined {
  return new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(source)?.[1];
}

function number(source: string, name: string): number {
  const value = Number(attribute(source, name));
  if (Number.isNaN(value)) throw new Error(`missing or invalid ${name} on <${source.trim()}>`);
  return value;
}

/** Turns the shapes Blode draws besides `<path>` into path data, so renderers only need paths. */
function shapeToPath(tag: string, attributes: string): string | undefined {
  if (tag === "circle") {
    const [cx, cy, r] = [
      number(attributes, "cx"),
      number(attributes, "cy"),
      number(attributes, "r"),
    ];
    return `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
  }
  if (tag === "rect") {
    const [x, y] = [number(attributes, "x"), number(attributes, "y")];
    const [w, h] = [number(attributes, "width"), number(attributes, "height")];
    const r = Math.min(Number(attribute(attributes, "rx") ?? 0), w / 2, h / 2);
    return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  }
  return undefined;
}

function readMarkup(name: string): { markup: string; strictRoot: boolean } {
  if (name in SVG_FILES) {
    const file = SVG_FILES[name as keyof typeof SVG_FILES];
    return { markup: readFileSync(new URL(file, import.meta.url), "utf8"), strictRoot: false };
  }

  const component = (Blode as Record<string, unknown>)[`${name}Icon`];
  if (!component) throw new Error(`blode-icons-react has no ${name}Icon`);
  return { markup: renderToStaticMarkup(createElement(component as never)), strictRoot: true };
}

function extractPaths(name: string): GeneratedPath[] {
  const { markup, strictRoot } = readMarkup(name);
  const svg = /<svg\s([^>]*)>/.exec(markup)?.[1] ?? "";
  if (attribute(svg, "viewBox") !== "0 0 24 24") {
    throw new Error(`${name}: expected a 24x24 icon, got <svg ${svg}>`);
  }
  if (strictRoot && attribute(svg, "stroke-width") !== "2") {
    throw new Error(`${name}: expected stroke-width 2, got <svg ${svg}>`);
  }

  const tags = [...markup.matchAll(/<(\w+)\s([^>]*?)\/?>/g)].filter((match) => match[1] !== "svg");
  if (tags.length === 0) throw new Error(`${name} rendered no shapes`);

  return tags.map(([, tag, attributes]) => {
    const d = tag === "path" ? attribute(attributes, "d") : shapeToPath(tag, attributes);
    if (tag !== "path" && !d) {
      throw new Error(`${name} renders <${tag}>; only path, rect and circle are supported`);
    }
    if (!d) throw new Error(`${name} has a path without data`);

    const isStroke = attribute(attributes, "stroke") === "currentColor";
    const isFill = attribute(attributes, "fill") === "currentColor";
    if (isStroke === isFill) throw new Error(`${name} has a path that is both or neither`);
    if (isStroke && !strictRoot && attribute(attributes, "stroke-width") !== "2") {
      throw new Error(`${name} has a stroke that is not 2 wide`);
    }

    const path: GeneratedPath = { d };
    if (attribute(attributes, "fill-rule") === "evenodd") path.fillRule = "evenodd";
    if (isStroke) {
      path.stroke = {};
      if (attribute(attributes, "stroke-linecap") === "round") path.stroke.linecap = "round";
      if (attribute(attributes, "stroke-linejoin") === "round") path.stroke.linejoin = "round";
    }
    return path;
  });
}

const NAMES = [...ICONS, ...Object.keys(SVG_FILES)].toSorted();

const entries = NAMES.map((name) => {
  const body = extractPaths(name)
    .map((path) => `    ${JSON.stringify(path)},`)
    .join("\n");
  return `export const ${name}NativeIcon: BlodeNativeIcon = {\n  viewBox,\n  paths: [\n${body}\n  ],\n};\n`;
});

writeFileSync(
  new URL("../src/icons/blode-native.ts", import.meta.url),
  `// Generated by scripts/generate-blode-native.ts from blode-icons-react (MIT). Do not edit.
/**
 * Renderer-neutral Blode geometry for native surfaces. Every path is either a fill or a
 * \`stroke\` path (stroke width 2, no fill) so React Native and SwiftUI can draw it without
 * importing the DOM icon components.
 */
export type BlodeNativePath = {
  readonly d: string;
  readonly fillRule?: "evenodd";
  readonly stroke?: { readonly linecap?: "round"; readonly linejoin?: "round" };
};

export type BlodeNativeIcon = {
  readonly viewBox: "0 0 24 24";
  readonly paths: readonly BlodeNativePath[];
};

/** Stroke width of every Blode line icon, in viewBox units. */
export const BLODE_STROKE_WIDTH = 2;

const viewBox = "0 0 24 24" as const;

${entries.join("\n")}`,
);
console.log(`Wrote ${NAMES.length} icons`);
