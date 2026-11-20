/**
 * Inline math ships a self-contained SVG next to its TeX so native renderers can draw formulas
 * that need real layout. The SVG comes from the compiler (MathJax) but is validated here against a
 * strict allowlist, by the schema and again by the compiler, so a stored document can never carry
 * script, `foreignObject`, event handlers, links, or external references.
 */
export const MAX_MATH_SVG_LENGTH = 40_000;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const NUMBER = String.raw`-?\d+(?:\.\d+)?(?:e-?\d+)?`;

const PAINT = /^(?:currentColor|none|#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,24})$/;

const TAGS = new Set(["svg", "g", "path", "rect", "line"]);

const VALUE_PATTERNS: Record<string, RegExp> = {
  xmlns: new RegExp(`^${SVG_NAMESPACE.replaceAll(".", String.raw`\.`)}$`),
  // MathJax writes a unitless `0` when the formula sits on the baseline.
  style: new RegExp(String.raw`^vertical-align: (?:0|${NUMBER}ex);$`),
  width: new RegExp(`^${NUMBER}(?:ex)?%?$`),
  height: new RegExp(`^${NUMBER}(?:ex)?%?$`),
  viewBox: new RegExp(`^${NUMBER}(?: ${NUMBER}){3}$`),
  role: /^img$/,
  focusable: /^false$/,
  "aria-hidden": /^true$/,
  // `\color`, `\textcolor` and `\colorbox` emit hex or named colours; never `url(...)`.
  stroke: PAINT,
  fill: PAINT,
  "stroke-width": new RegExp(`^${NUMBER}$`),
  "stroke-linecap": /^(?:butt|round|square)$/,
  "stroke-dasharray": /^[\d. ,-]{1,64}$/,
  transform: /^(?:(?:translate|scale)\([\d.,\s-]{1,64}\)\s*){1,4}$/,
  d: /^[MmLlHhVvCcSsQqTtAaZz\d.,\s-]{0,20000}$/,
  x: new RegExp(`^${NUMBER}$`),
  y: new RegExp(`^${NUMBER}$`),
  x1: new RegExp(`^${NUMBER}$`),
  x2: new RegExp(`^${NUMBER}$`),
  y1: new RegExp(`^${NUMBER}$`),
  y2: new RegExp(`^${NUMBER}$`),
  "data-mml-node": /^[\w-]{1,32}$/,
  "data-bgcolor": /^true$/,
  "data-cramped": /^(?:true|false)$/,
  "data-c": /^[0-9A-F]{1,8}$/i,
  "data-latex": /^[^"<>&]{0,200}$/,
  "data-latex-item": /^[^"<>&]{0,200}$/,
};

const TAG = /<(\/?)([A-Za-z][\w-]*)((?:\s+[A-Za-z][\w:-]*="[^"<>&]*")*)\s*(\/?)>/y;
const ATTRIBUTE = /\s+([A-Za-z][\w:-]*)="([^"]*)"/g;

function hasAllowedAttributes(attributes: string): boolean {
  for (const attr of attributes.matchAll(ATTRIBUTE)) {
    const attrName = attr[1] ?? "";
    const pattern = /^data-mjx-[a-z-]{1,24}$/.test(attrName)
      ? /^[\w -]{0,32}$/
      : Object.hasOwn(VALUE_PATTERNS, attrName)
        ? VALUE_PATTERNS[attrName]
        : undefined;
    if (!pattern?.test(attr[2] ?? "")) {
      return false;
    }
  }
  return true;
}

/** An opening tag is valid when only `<svg>` opens the tree, at offset 0, with allowlisted attributes. */
function isAllowedOpeningTag(
  stack: readonly string[],
  cursor: number,
  name: string,
  attributes: string,
): boolean {
  if (stack.length === 0 && (cursor !== 0 || name !== "svg")) {
    return false;
  }
  return hasAllowedAttributes(attributes);
}

/** True when the whitespace between `cursor` and the next tag is the only text allowed. */
function isBlankGap(svg: string, cursor: number, next: number): boolean {
  const gap = next === -1 ? svg.slice(cursor) : svg.slice(cursor, next);
  return !gap.trim();
}

/** True when `svg` is one bounded, well-formed `<svg>` tree that uses only allowlisted parts. */
export function isSafeMathSvg(svg: string): boolean {
  if (svg.length === 0 || svg.length > MAX_MATH_SVG_LENGTH || !svg.startsWith("<svg")) {
    return false;
  }
  const stack: string[] = [];
  let cursor = 0;
  let closedRoot = false;
  while (cursor < svg.length) {
    if (svg[cursor] !== "<") {
      return false;
    }
    TAG.lastIndex = cursor;
    const match = TAG.exec(svg);
    if (!match || closedRoot) {
      return false;
    }
    const [whole, closing, name = "", attributes = "", selfClosing] = match;
    if (!TAGS.has(name)) {
      return false;
    }
    if (closing) {
      if (selfClosing || attributes || stack.pop() !== name) {
        return false;
      }
      closedRoot = stack.length === 0;
    } else {
      if (!isAllowedOpeningTag(stack, cursor, name, attributes)) {
        return false;
      }
      if (selfClosing) {
        closedRoot = stack.length === 0;
      } else {
        stack.push(name);
      }
    }
    cursor += whole.length;
    const next = svg.indexOf("<", cursor);
    if (!isBlankGap(svg, cursor, next)) {
      return false;
    }
    cursor = next === -1 ? svg.length : next;
  }
  return closedRoot && stack.length === 0;
}
