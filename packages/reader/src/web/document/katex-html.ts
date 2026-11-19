/**
 * `rendered` is KaTeX output the compiler produced with `trust: false`, and it is injected as-is.
 * It is accepted only as one well-formed tree of the elements, attributes and classes KaTeX writes
 * (`<span class="katex">` wrapping MathML and, for stretchy parts, `<svg>`); anything else is
 * refused and the math falls back to its MathML or TeX. This is an allowlist, not a scan for bad
 * strings, so a payload written to slip past a pattern has nothing to match: there is no script,
 * link, image, style element, comment, event handler, URL-valued attribute or unknown class, and
 * HTML, MathML and SVG elements may not nest in ways that make the parser switch namespaces.
 */

const MATHML_TAGS = new Set([
  "math",
  "semantics",
  "annotation",
  "mrow",
  "mi",
  "mn",
  "mo",
  "mtext",
  "mspace",
  "msup",
  "msub",
  "msubsup",
  "mfrac",
  "mover",
  "munder",
  "munderover",
  "msqrt",
  "mroot",
  "mstyle",
  "mpadded",
  "mphantom",
  "menclose",
  "mtable",
  "mtr",
  "mlabeledtr",
  "mtd",
]);

/** Drawn by `<svg>`; always written self-closed. `<mspace/>` may be written either way. */
const SVG_PARTS = new Set(["path", "line"]);
const SELF_CLOSING = new Set(["mspace", "path", "line"]);

/** Classes KaTeX writes (its stylesheet's selectors plus the atom, size and script-fallback ones). */
const KATEX_CLASSES = new Set(
  `accent accent-body accent-full accentunder allowbreak amsrm angl anglpad armenian_fallback
  arraycolsep base boldsymbol boxpad brace-center brace-left brace-right brahmic_fallback
  cancel-lap cancel-pad cd-arrow-pad cd-label-left cd-label-right cd-vert-arrow cjk_fallback clap
  col-align-c col-align-l col-align-r colorbox cyrillic_fallback delimcenter delimsizing
  delimsizinginner eqn-num fbox fcolorbox fix fleqn fontsize-ensurer frac-line georgian_fallback
  halfarrow-left halfarrow-right hangul_fallback hbox hdashline hide-tail hline inner katex
  katex-display katex-html katex-mathml katex-version large-op latin_fallback leftmost leqno llap
  mainrm mathbb mathbf mathboldfrak mathboldsf mathcal mathfrak mathit mathitsf mathnormal mathrm
  mathscr mathsf mathsfit mathtt mbin mclose mfrac minner mml-eqn-num mop mopen mord mover mpunct
  mrel mspace msupsub mtable mtight mtr-glue mult munder newline nobreak nulldelimiter op-limits
  op-symbol overlay overline overline-line pstrut rlap root rule sizing small-op smash sout sqrt
  stretchy strut svg-align tag text textbb textbf textboldfrak textboldsf textfrak textit textitsf
  textmd textrm textscr textsf texttt textup thinbox underline underline-line vbox vcenter
  vertical-separator vlist vlist-r vlist-s vlist-t vlist-t2 x-arrow x-arrow-pad`.split(/\s+/),
);
const KATEX_SIZE_CLASS = /^(?:reset-size|size|delim-size)\d{1,2}$/;

/** The inline styles KaTeX sets, which are all lengths, colors and `position: relative`. */
const STYLE_PROPERTIES = new Set([
  "background-color",
  "border",
  "border-bottom-width",
  "border-color",
  "border-right-style",
  "border-right-width",
  "border-style",
  "border-top-width",
  "border-width",
  "bottom",
  "color",
  "height",
  "left",
  "margin",
  "margin-left",
  "margin-right",
  "margin-top",
  "min-width",
  "padding-left",
  "position",
  "text-shadow",
  "top",
  "vertical-align",
  "width",
]);

/** Letters, digits and the punctuation of lengths and colors: no parentheses, quotes or slashes. */
const TOKEN = /^[A-Za-z0-9 .#%+-]{0,64}$/;

function isKatexClassList(value: string): boolean {
  return value.split(" ").every((name) => KATEX_CLASSES.has(name) || KATEX_SIZE_CLASS.test(name));
}

function isKatexStyle(value: string): boolean {
  return value.split(";").every((declaration) => {
    if (!declaration) {
      return true;
    }
    const colon = declaration.indexOf(":");
    const property = declaration.slice(0, colon).trim();
    const setting = declaration.slice(colon + 1);
    return (
      colon > 0 &&
      STYLE_PROPERTIES.has(property) &&
      TOKEN.test(setting) &&
      (property !== "position" || setting === "relative")
    );
  });
}

const matches = (pattern: RegExp) => (value: string) => pattern.test(value);
const MATHML_ATTRIBUTES = [
  "accent",
  "accentunder",
  "columnalign",
  "columnlines",
  "columnspacing",
  "depth",
  "display",
  "displaystyle",
  "fence",
  "height",
  "largeop",
  "linebreak",
  "linethickness",
  "lspace",
  "mathbackground",
  "mathcolor",
  "mathsize",
  "mathvariant",
  "maxsize",
  "minsize",
  "notation",
  "rowlines",
  "rowspacing",
  "rspace",
  "scriptlevel",
  "separator",
  "stretchy",
  "valign",
  "voffset",
  "width",
  // SVG `<line>`.
  "stroke-width",
  "x1",
  "x2",
  "y1",
  "y2",
];

/** Attribute name to value check. A map, so `constructor` is not an attribute rule. */
const ATTRIBUTE_RULES = new Map<string, (value: string) => boolean>([
  ...MATHML_ATTRIBUTES.map((name): [string, (value: string) => boolean] => [name, matches(TOKEN)]),
  ["class", isKatexClassList],
  ["style", isKatexStyle],
  ["aria-hidden", (value) => value === "true"],
  [
    "xmlns",
    (value) =>
      value === "http://www.w3.org/1998/Math/MathML" || value === "http://www.w3.org/2000/svg",
  ],
  ["encoding", (value) => value === "application/x-tex"],
  ["viewBox", matches(/^[0-9. -]{1,64}$/)],
  ["preserveAspectRatio", matches(/^[A-Za-z ]{1,32}$/)],
  ["d", matches(/^[A-Za-z0-9.,\s-]*$/)],
]);

const TAG = /<(\/?)([a-z][a-z0-9]*)((?:\s+[A-Za-z][\w-]*\s*=\s*"[^"<>&]*")*)\s*(\/?)>/y;
const ATTRIBUTE = /\s+([A-Za-z][\w-]*)\s*=\s*"([^"]*)"/g;

/** Whether `tag` may open directly inside `parent` (`undefined` at the root). */
function mayNest(tag: string, parent: string | undefined): boolean {
  switch (tag) {
    case "span":
      return parent === undefined || parent === "span";
    case "math":
    case "svg":
      return parent === "span";
    case "path":
    case "line":
      return parent === "svg";
    default:
      return parent !== undefined && MATHML_TAGS.has(parent);
  }
}

/** Whether an opening tag with these attributes may start inside `parent`. */
function isAcceptableOpening(
  name: string,
  selfClosing: boolean,
  attributes: string,
  parent: string | undefined,
): boolean {
  const known = name === "span" || name === "svg" || SVG_PARTS.has(name) || MATHML_TAGS.has(name);
  const wellShaped = selfClosing ? SELF_CLOSING.has(name) : !SVG_PARTS.has(name);
  if (!known || !wellShaped || !mayNest(name, parent)) {
    return false;
  }
  return [...attributes.matchAll(ATTRIBUTE)].every((attribute) =>
    ATTRIBUTE_RULES.get(attribute[1] ?? "")?.(attribute[2] ?? ""),
  );
}

/** True when `html` is KaTeX output: one `<span>` tree built only from KaTeX's own parts. */
export function isTrustedKatexHtml(html: string): boolean {
  const open: string[] = [];
  let closedRoot = false;
  let cursor = 0;
  while (cursor < html.length) {
    // Text carries no markup: KaTeX escapes `<`, `>` and `&` in it.
    if (html[cursor] !== "<") {
      const next = html.indexOf("<", cursor);
      const end = next === -1 ? html.length : next;
      if (open.length === 0 || html.slice(cursor, end).includes(">")) {
        return false;
      }
      cursor = end;
      continue;
    }

    TAG.lastIndex = cursor;
    const match = TAG.exec(html);
    if (!match || closedRoot) {
      return false;
    }
    const [whole, closing, name = "", attributes = "", selfClosing] = match;
    if (closing) {
      if (selfClosing || attributes || open.pop() !== name) {
        return false;
      }
      closedRoot = open.length === 0;
    } else if (isAcceptableOpening(name, selfClosing === "/", attributes, open.at(-1))) {
      if (selfClosing !== "/") {
        open.push(name);
      }
    } else {
      return false;
    }
    cursor += whole.length;
  }
  return closedRoot && open.length === 0;
}
