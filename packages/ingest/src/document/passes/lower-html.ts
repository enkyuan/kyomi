import type {
  ReaderBlock,
  ReaderImage,
  ReaderInline,
  ReaderListItem,
  ReaderPlacement,
  ReaderTableCell,
} from "@kyomi/reader/document";
import { parseSrcset } from "@kyomi/reader/sanitization";
import type { BlockHint, DraftFootnote } from "../document-draft";

const MAX_DEPTH = 48;
/** Inline nesting past this is flattened to its text, so hostile markup cannot exhaust the stack. */
const MAX_INLINE_DEPTH = 100;
const MAX_MATHML_LENGTH = 20_000;
const MAX_CODE_LENGTH = 200_000;

/** What lowering shares across one document: where to put hints, footnote bodies, and warnings. */
export type LowerContext = {
  hints: WeakMap<object, BlockHint>;
  defs: DraftFootnote[];
  warnings: string[];
  sidenotes: number;
};

export function createLowerContext(): LowerContext {
  return { hints: new WeakMap(), defs: [], warnings: [], sidenotes: 0 };
}

const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "audio",
  "blockquote",
  "dd",
  "details",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "ol",
  "p",
  "pre",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
  "video",
]);
const BLOCK_SELECTOR = Array.from(BLOCK_TAGS).join(",");

const ANCHOR = /^[a-z0-9][a-z0-9-]{0,63}$/;
const HEADING = /^h([1-6])$/;
const BACKREF_TEXT = /^[\u21a9\u21b5\u23ce\u2191^]+[\ufe0e\ufe0f]?$/u;
const NUMERIC_LABEL = /^\[?\d{1,3}\]?$/;
const FOOTNOTES_TITLE = /^(?:foot|end)?notes?$/i;
const IMAGE_URL = /\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#]|$)|\/image\//i;
const COLLAPSE = /[ \t\n\r\f]+/g;

function tagOf(node: Node): string {
  return (node as Element).tagName?.toLowerCase() ?? "";
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}

function isText(node: Node): boolean {
  return node.nodeType === 3;
}

function attr(element: Element, name: string): string | null {
  return element.getAttribute(name);
}

function role(element: Element): string | null {
  return attr(element, "data-kyomi-role");
}

export function httpUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function positiveInt(value: string | null): number | undefined {
  if (!value || !/^\d{1,5}$/.test(value)) {
    return undefined;
  }
  const parsed = Number(value);
  return parsed > 0 ? parsed : undefined;
}

function anchorOf(element: Element): string | undefined {
  const id = attr(element, "id");
  return id && ANCHOR.test(id) ? id : undefined;
}

/** Block anchor: the element's own id, else the first id met inside its inline content. */
function pickAnchor(own: Element | null, collected: string[]): { anchor?: string } {
  const anchor = (own && anchorOf(own)) ?? collected.find((id) => ANCHOR.test(id));
  return anchor ? { anchor } : {};
}

function placementOf(element: Element): ReaderPlacement {
  const hinted = element.closest("[data-kyomi-placement]")?.getAttribute("data-kyomi-placement");
  return hinted === "wide" || hinted === "full" || hinted === "start" || hinted === "end"
    ? hinted
    : "content";
}

function limited(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/* ------------------------------------------------------------------ images */

function imageOf(element: Element, wrapper?: Element | null): ReaderImage | null {
  const img = tagOf(element) === "img" ? element : element.querySelector("img");
  if (!img) {
    return null;
  }
  const src = httpUrl(attr(img, "src"));
  if (!src) {
    return null;
  }
  const image: ReaderImage = { src, alt: (attr(img, "alt") ?? "").trim() };
  const width = positiveInt(attr(img, "width"));
  const height = positiveInt(attr(img, "height"));
  if (width && height) {
    image.width = width;
    image.height = height;
  }
  const picture = img.closest("picture");
  const srcset =
    attr(img, "srcset") ??
    (picture ? attr(picture.querySelector("source") ?? img, "srcset") : null);
  const candidates = parseSrcset(srcset ?? "").flatMap(({ url, descriptor }) => {
    const resolved = httpUrl(url);
    if (!resolved) {
      return [];
    }
    const amount = descriptor ? Number(descriptor.slice(0, -1)) : Number.NaN;
    if (descriptor?.endsWith("w") && Number.isInteger(amount) && amount > 0) {
      return [{ url: resolved, width: amount }];
    }
    if (descriptor?.endsWith("x") && amount > 0) {
      return [{ url: resolved, density: amount }];
    }
    return [{ url: resolved }];
  });
  if (candidates.length > 0) {
    image.srcset = candidates;
  }
  const link = wrapper ?? img.closest("a");
  const href = httpUrl(link ? attr(link, "href") : null);
  if (href && href !== src && !IMAGE_URL.test(href)) {
    image.href = href;
  }
  return image;
}

/* ----------------------------------------------------------------- inlines */

type InlineState = { ctx: LowerContext; anchors: string[]; depth?: number };

function text(value: string): ReaderInline[] {
  return value ? [{ type: "text", value }] : [];
}

function collapse(value: string): string {
  return value.replace(COLLAPSE, " ");
}

function mathmlOf(math: Element): { tex?: string; mathml?: string } {
  const tex = Array.from(math.querySelectorAll("annotation"))
    .find((annotation) => attr(annotation, "encoding") === "application/x-tex")
    ?.textContent?.trim();
  if (tex) {
    return { tex };
  }
  const mathml = math.outerHTML.trim();
  return mathml.length <= MAX_MATHML_LENGTH ? { mathml } : {};
}

function katexOf(span: Element): { tex?: string; mathml?: string } {
  const math = span.querySelector("math");
  return math ? mathmlOf(math) : {};
}

function sidenote(element: Element, state: InlineState): ReaderInline[] {
  const { ctx } = state;
  ctx.sidenotes += 1;
  const anchor = `kyomi-sidenote-${ctx.sidenotes}`;
  const body = lowerInlines(Array.from(element.childNodes), { ctx, anchors: [] });
  if (body.length > 0) {
    ctx.defs.push({
      anchors: [anchor],
      presentation: "sidenote",
      children: [{ type: "paragraph", children: body }],
    });
  }
  return body.length > 0
    ? [{ type: "link", href: `#${anchor}`, children: text(String(ctx.sidenotes)) }]
    : [];
}

const FORMATS: Record<
  string,
  | "strong"
  | "emphasis"
  | "underline"
  | "strike"
  | "insert"
  | "subscript"
  | "superscript"
  | "highlight"
  | "small"
  | "keyboard"
  | "cite"
  | "quote"
> = {
  strong: "strong",
  b: "strong",
  em: "emphasis",
  i: "emphasis",
  u: "underline",
  s: "strike",
  del: "strike",
  strike: "strike",
  ins: "insert",
  sub: "subscript",
  sup: "superscript",
  mark: "highlight",
  small: "small",
  kbd: "keyboard",
  cite: "cite",
  q: "quote",
};

function lowerInlineElement(element: Element, parent: InlineState): ReaderInline[] {
  const depth = (parent.depth ?? 0) + 1;
  if (depth > MAX_INLINE_DEPTH) {
    return text(collapse(element.textContent ?? ""));
  }
  const state = { ...parent, depth };
  const tag = tagOf(element);
  const id = attr(element, "id");
  if (id) {
    state.anchors.push(id);
  }

  if (role(element) === "sidenote") {
    return sidenote(element, state);
  }
  const children = () => lowerInlines(Array.from(element.childNodes), state);

  const format = FORMATS[tag];
  if (format) {
    const inner = children();
    return inner.length > 0 ? [{ type: "format", format, children: inner }] : [];
  }

  switch (tag) {
    case "a": {
      const href = attr(element, "href")?.trim() ?? "";
      const target = href.startsWith("#") ? href : httpUrl(href);
      const inner = children();
      if (!target || inner.length === 0) {
        return inner;
      }
      const title = attr(element, "title")?.trim();
      return [{ type: "link", href: target, ...(title ? { title } : {}), children: inner }];
    }
    case "code":
    case "samp": {
      const value = element.textContent ?? "";
      return value ? [{ type: "code", value }] : [];
    }
    case "abbr": {
      const title = attr(element, "title")?.trim();
      const inner = children();
      return title && inner.length > 0 ? [{ type: "abbr", title, children: inner }] : inner;
    }
    case "br":
      return [{ type: "break" }];
    case "img":
    case "picture": {
      const image = imageOf(element);
      if (image) {
        return [{ type: "image", image }];
      }
      return text(attr(element, "alt") ?? "");
    }
    case "math": {
      const math = mathmlOf(element);
      return math.tex || math.mathml ? [{ type: "math", ...math }] : children();
    }
    case "span": {
      if ((attr(element, "class") ?? "").split(/\s+/).includes("katex")) {
        const math = katexOf(element);
        return math.tex || math.mathml ? [{ type: "math", ...math }] : children();
      }
      return children();
    }
    case "rt": {
      const inner = children();
      return inner.length > 0
        ? [{ type: "text", value: "(" }, ...inner, { type: "text", value: ")" }]
        : [];
    }
    case "rp":
    case "wbr":
    case "source":
      return [];
    default:
      return children();
  }
}

/** Adjacent text nodes (the parser splits at entities) become one, so delimiters stay whole. */
function mergeText(inlines: ReaderInline[]): ReaderInline[] {
  const merged: ReaderInline[] = [];
  for (const inline of inlines) {
    const previous = merged.at(-1);
    if (inline.type === "text" && previous?.type === "text") {
      merged[merged.length - 1] = { type: "text", value: previous.value + inline.value };
    } else {
      merged.push(inline);
    }
  }
  return merged;
}

export function lowerInlines(nodes: Node[], state: InlineState): ReaderInline[] {
  const out: ReaderInline[] = [];
  for (const node of nodes) {
    if (isText(node)) {
      out.push(...text(collapse(node.textContent ?? "")));
    } else if (isElement(node)) {
      out.push(...lowerInlineElement(node, state));
    }
  }
  return mergeText(out);
}

function isBlank(inlines: ReaderInline[]): boolean {
  return inlines.every(
    (inline) => (inline.type === "text" && !/\S/u.test(inline.value)) || inline.type === "break",
  );
}

/* ------------------------------------------------------------------ blocks */

function containsBlock(element: Element): boolean {
  return element.querySelector(BLOCK_SELECTOR) !== null;
}

function isBlockNode(node: Node): boolean {
  if (!isElement(node)) {
    return false;
  }
  const tag = tagOf(node);
  if (BLOCK_TAGS.has(tag) || (tag === "math" && attr(node, "display") === "block")) {
    return true;
  }
  // An inline wrapper around block content (`<a><div>…</div></a>`) is transparent.
  return tag !== "img" && tag !== "picture" && tag !== "code" && containsBlock(node);
}

function paragraphOf(nodes: Node[], ctx: LowerContext, own: Element | null): ReaderBlock | null {
  const anchors: string[] = [];
  const children = lowerInlines(nodes, { ctx, anchors });
  if (isBlank(children)) {
    return null;
  }
  return { type: "paragraph", ...pickAnchor(own, anchors), children };
}

/** Images and links around them with no other content: each becomes its own figure. */
function imagesOnly(nodes: Node[]): Element[] | null {
  const media: Element[] = [];
  for (const node of nodes) {
    if (isText(node)) {
      if (/\S/u.test(node.textContent ?? "")) {
        return null;
      }
      continue;
    }
    if (!isElement(node)) {
      continue;
    }
    const tag = tagOf(node);
    if (tag === "br") {
      continue;
    }
    if (tag === "img" || tag === "picture") {
      media.push(node);
    } else if (tag === "a" && node.querySelector("img") && !(node.textContent ?? "").trim()) {
      media.push(node);
    } else {
      return null;
    }
  }
  return media.length > 0 ? media : null;
}

function figuresFromMedia(media: Element[], ctx: LowerContext): ReaderBlock[] {
  const blocks: ReaderBlock[] = [];
  for (const element of media) {
    const image = imageOf(element, tagOf(element) === "a" ? element : null);
    if (image) {
      blocks.push({ type: "figure", placement: placementOf(element), image });
    }
  }
  if (blocks.length > 1) {
    // Sibling images with nothing between them are laid out together by the figures pass.
    const group = { layout: "grid" as const };
    for (const block of blocks) {
      withHint(block, ctx, { gallery: group });
    }
  }
  return blocks;
}

function lowerRun(nodes: Node[], ctx: LowerContext, own: Element | null): ReaderBlock[] {
  const media = imagesOnly(nodes);
  if (media) {
    return figuresFromMedia(media, ctx);
  }
  const paragraph = paragraphOf(nodes, ctx, own);
  return paragraph ? [paragraph] : [];
}

export function lowerChildren(nodes: Node[], ctx: LowerContext, depth: number): ReaderBlock[] {
  if (depth > MAX_DEPTH) {
    return [];
  }
  const out: ReaderBlock[] = [];
  let run: Node[] = [];
  const flush = () => {
    if (run.length > 0) {
      out.push(...lowerRun(run, ctx, null));
      run = [];
    }
  };
  for (const node of nodes) {
    if (isBlockNode(node)) {
      flush();
      out.push(...lowerBlockElement(node as Element, ctx, depth + 1));
    } else if (isElement(node) || isText(node)) {
      run.push(node);
    }
  }
  flush();
  return out;
}

function htmlBlock(element: Element, reason: string): ReaderBlock {
  return { type: "html", html: element.outerHTML, reason: limited(reason, 128) };
}

function withHint(block: ReaderBlock, ctx: LowerContext, hint: BlockHint): ReaderBlock {
  ctx.hints.set(block, { ...ctx.hints.get(block), ...hint });
  return block;
}

/* ---- captions, quotes ---- */

function captionOf(
  figcaption: Element | null,
  ctx: LowerContext,
): { caption?: ReaderInline[]; credit?: ReaderInline[] } {
  if (!figcaption) {
    return {};
  }
  let creditNode: Element | null =
    Array.from(figcaption.querySelectorAll("[data-kyomi-role]")).find(
      (candidate) => role(candidate) === "credit",
    ) ?? null;
  if (!creditNode) {
    const last = figcaption.lastElementChild;
    if (last && tagOf(last) === "cite" && figcaption.children.length > 0) {
      creditNode = last;
    }
  }
  const credit = creditNode
    ? lowerInlines(Array.from(creditNode.childNodes), { ctx, anchors: [] })
    : [];
  creditNode?.remove();
  const caption = lowerInlines(Array.from(figcaption.childNodes), { ctx, anchors: [] });
  return {
    ...(isBlank(caption) ? {} : { caption }),
    ...(isBlank(credit) ? {} : { credit }),
  };
}

function directFigcaption(figure: Element): Element | null {
  return Array.from(figure.children).find((child) => tagOf(child) === "figcaption") ?? null;
}

function quoteParts(element: Element, ctx: LowerContext) {
  let attribution: ReaderInline[] | undefined;
  const footer = Array.from(element.children).find((child) => tagOf(child) === "footer");
  const cite = Array.from(element.children).find((child) => tagOf(child) === "cite");
  const source = footer ?? cite;
  if (source) {
    const inlines = lowerInlines(Array.from(source.childNodes), { ctx, anchors: [] });
    const first = inlines[0];
    if (first?.type === "text") {
      first.value = first.value.replace(/^\s*[—–-]+\s*/u, "");
    }
    if (!isBlank(inlines)) {
      attribution = inlines;
    }
    source.remove();
  }
  return attribution;
}

function pullQuote(element: Element, ctx: LowerContext): ReaderBlock | null {
  const blockquote =
    tagOf(element) === "blockquote" ? element : element.querySelector("blockquote");
  const host = blockquote ?? element;
  const attribution = quoteParts(host, ctx);
  const children: ReaderInline[] = [];
  const paragraphs = Array.from(host.querySelectorAll("p"));
  const sources = paragraphs.length > 0 ? paragraphs : [host];
  for (const [index, paragraph] of sources.entries()) {
    if (index > 0) {
      children.push({ type: "break" });
    }
    children.push(...lowerInlines(Array.from(paragraph.childNodes), { ctx, anchors: [] }));
  }
  if (isBlank(children)) {
    return null;
  }
  return { type: "pullQuote", children, ...(attribution ? { attribution } : {}) };
}

const ALERT = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i;

function lowerBlockquote(element: Element, ctx: LowerContext, depth: number): ReaderBlock[] {
  if (role(element) === "pullquote") {
    const block = pullQuote(element, ctx);
    return block ? [block] : [];
  }
  const attribution = quoteParts(element, ctx);
  const children = lowerChildren(Array.from(element.childNodes), ctx, depth);
  const first = children[0];
  const lead = first?.type === "paragraph" ? first.children[0] : undefined;
  const alert = lead?.type === "text" ? ALERT.exec(lead.value) : null;
  if (alert && first?.type === "paragraph" && lead?.type === "text") {
    lead.value = lead.value.slice(alert[0].length);
    if (!lead.value && first.children.length === 1) {
      children.shift();
    }
    return [
      {
        type: "callout",
        variant: alert[1]!.toLowerCase() as "note",
        children,
      },
    ];
  }
  return [
    {
      type: "quote",
      ...pickAnchor(element, []),
      ...(attribution ? { attribution } : {}),
      children,
    },
  ];
}

/* ---- lists, tables, definition lists, details ---- */

function lowerList(element: Element, ctx: LowerContext, depth: number): ReaderBlock[] {
  const items: ReaderListItem[] = [];
  for (const child of Array.from(element.children)) {
    if (tagOf(child) !== "li") {
      continue;
    }
    const checked = attr(child, "data-kyomi-checked");
    const children = lowerChildren(Array.from(child.childNodes), ctx, depth);
    const anchor = anchorOf(child);
    const first = children[0];
    if (anchor && first && first.anchor === undefined) {
      first.anchor = anchor;
    }
    items.push({ checked: checked === null ? null : checked === "true", children });
  }
  if (items.length === 0) {
    return [];
  }
  const start = Number(attr(element, "start"));
  const ordered = tagOf(element) === "ol";
  return [
    {
      type: "list",
      ...pickAnchor(element, []),
      ordered,
      ...(ordered && Number.isInteger(start) && attr(element, "start") !== null ? { start } : {}),
      items,
    },
  ];
}

function lowerCell(cell: Element, ctx: LowerContext, depth: number): ReaderTableCell {
  const align = attr(cell, "align")?.toLowerCase();
  const colSpan = positiveInt(attr(cell, "colspan"));
  const rowSpan = positiveInt(attr(cell, "rowspan"));
  return {
    header: tagOf(cell) === "th",
    ...(colSpan && colSpan > 1 ? { colSpan } : {}),
    ...(rowSpan && rowSpan > 1 ? { rowSpan } : {}),
    ...(align === "left"
      ? { align: "start" as const }
      : align === "right"
        ? { align: "end" as const }
        : align === "center"
          ? { align: "center" as const }
          : {}),
    children: lowerChildren(Array.from(cell.childNodes), ctx, depth),
  };
}

function rowsOf(section: Element): Element[] {
  return Array.from(section.children).filter((child) => tagOf(child) === "tr");
}

const EQUATION_NUMBER = /^(?:\([\w.-]{1,8}\)|\[[\w.-]{1,8}\]|\d{1,3}(?:\.\d{1,3})?)$/;

/**
 * LaTeXML and similar converters lay a display equation out as a one-row table: an empty cell,
 * the math, an empty cell, and an equation number. That is one display equation, not a table.
 */
function equationOf(row: ReaderTableCell[]): ReaderBlock | null {
  let equation: ReaderBlock | null = null;
  for (const cell of row) {
    const only = cell.children.length === 1 ? cell.children[0] : undefined;
    const inline =
      only?.type === "paragraph" && only.children.length === 1 ? only.children[0] : undefined;
    const math = only?.type === "math" ? only : inline?.type === "math" ? { ...inline } : null;
    if (math) {
      if (equation) {
        return null;
      }
      equation = { ...math, type: "math" } as ReaderBlock;
      continue;
    }
    const label = cell.children
      .map((child) => (child.type === "paragraph" ? child.children : []))
      .flat();
    const labelText = label
      .map((part) => (part.type === "text" ? part.value : "\0"))
      .join("")
      .trim();
    if (cell.children.length > 0 && !EQUATION_NUMBER.test(labelText)) {
      return null;
    }
  }
  return equation;
}

function lowerTable(table: Element, ctx: LowerContext, depth: number): ReaderBlock[] {
  const sections = { head: [] as Element[], body: [] as Element[], foot: [] as Element[] };
  let captionElement: Element | null = null;
  for (const child of Array.from(table.children)) {
    switch (tagOf(child)) {
      case "caption":
        captionElement = child;
        break;
      case "thead":
        sections.head.push(...rowsOf(child));
        break;
      case "tfoot":
        sections.foot.push(...rowsOf(child));
        break;
      case "tbody":
        sections.body.push(...rowsOf(child));
        break;
      case "tr":
        sections.body.push(child);
        break;
      default:
        break;
    }
  }
  const cellsOf = (row: Element) =>
    Array.from(row.children)
      .filter((cell) => tagOf(cell) === "td" || tagOf(cell) === "th")
      .map((cell) => lowerCell(cell, ctx, depth));
  // Some publishers put header cells in the first body row instead of a thead.
  if (
    sections.head.length === 0 &&
    sections.body.length > 1 &&
    Array.from(sections.body[0]!.children).every((cell) => tagOf(cell) === "th")
  ) {
    sections.head.push(sections.body.shift()!);
  }
  const head = sections.head.map(cellsOf).filter((row) => row.length > 0);
  const body = sections.body.map(cellsOf).filter((row) => row.length > 0);
  const foot = sections.foot.map(cellsOf).filter((row) => row.length > 0);
  if (head.length + body.length + foot.length === 0) {
    return [];
  }
  const equation =
    head.length === 0 && foot.length === 0 && body.length === 1 && !captionElement
      ? equationOf(body[0]!)
      : null;
  if (equation) {
    return [{ ...equation, ...pickAnchor(table, []) } as ReaderBlock];
  }
  const caption = captionElement
    ? lowerInlines(Array.from(captionElement.childNodes), { ctx, anchors: [] })
    : [];
  return [
    {
      type: "table",
      ...pickAnchor(table, []),
      ...(isBlank(caption) ? {} : { caption }),
      head,
      body,
      ...(foot.length > 0 ? { foot } : {}),
    },
  ];
}

function lowerDefinitionList(dl: Element, ctx: LowerContext, depth: number): ReaderBlock[] {
  const items: { terms: ReaderInline[][]; definitions: ReaderBlock[][] }[] = [];
  let current: { terms: ReaderInline[][]; definitions: ReaderBlock[][] } | null = null;
  const visit = (element: Element) => {
    for (const child of Array.from(element.children)) {
      const tag = tagOf(child);
      if (tag === "dt") {
        if (!current || current.definitions.length > 0) {
          current = { terms: [], definitions: [] };
          items.push(current);
        }
        current.terms.push(lowerInlines(Array.from(child.childNodes), { ctx, anchors: [] }));
      } else if (tag === "dd") {
        if (!current) {
          current = { terms: [[{ type: "text", value: "" }]], definitions: [] };
          items.push(current);
        }
        current.definitions.push(lowerChildren(Array.from(child.childNodes), ctx, depth));
      } else if (tag === "div") {
        visit(child);
      }
    }
  };
  visit(dl);
  const usable = items.filter((item) => item.terms.length > 0);
  return usable.length > 0
    ? [{ type: "definitionList", ...pickAnchor(dl, []), items: usable }]
    : [];
}

function lowerDetails(element: Element, ctx: LowerContext, depth: number): ReaderBlock[] {
  const summaryElement = Array.from(element.children).find((child) => tagOf(child) === "summary");
  const summary = summaryElement
    ? lowerInlines(Array.from(summaryElement.childNodes), { ctx, anchors: [] })
    : [];
  summaryElement?.remove();
  return [
    {
      type: "details",
      ...pickAnchor(element, []),
      summary: isBlank(summary) ? text("Details") : summary,
      open: element.hasAttribute("open"),
      children: lowerChildren(Array.from(element.childNodes), ctx, depth),
    },
  ];
}

/* ---- code, math, media ---- */

function codeText(node: Node): string {
  let value = "";
  for (const child of Array.from(node.childNodes)) {
    if (isText(child)) {
      value += child.textContent ?? "";
    } else if (isElement(child)) {
      value += tagOf(child) === "br" ? "\n" : codeText(child);
    }
  }
  return value;
}

function highlightLines(value: string | null): number[] | undefined {
  if (!value) {
    return undefined;
  }
  const lines = new Set<number>();
  for (const part of value.split(",")) {
    const range = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!range) {
      continue;
    }
    const from = Number(range[1]);
    const to = Number(range[2] ?? range[1]);
    for (let line = from; line <= Math.min(to, from + 5_000); line += 1) {
      if (line > 0) {
        lines.add(line);
      }
    }
  }
  return lines.size > 0 ? Array.from(lines).sort((a, b) => a - b) : undefined;
}

function lowerCode(pre: Element, ctx: LowerContext): ReaderBlock[] {
  const value = codeText(pre).replace(/\n$/, "");
  if (!value.trim()) {
    return [];
  }
  const filename = attr(pre, "data-kyomi-filename");
  const lines = highlightLines(attr(pre, "data-kyomi-lines"));
  const block: ReaderBlock = {
    type: "code",
    ...pickAnchor(pre, []),
    value: limited(value, MAX_CODE_LENGTH),
    language: null,
    languageSource: "none",
    label: "Plain text",
    ...(filename ? { filename: limited(filename, 256) } : {}),
    ...(lines ? { highlightLines: lines } : {}),
  };
  const language = attr(pre, "data-kyomi-lang");
  if (language) {
    withHint(block, ctx, { codeLanguage: language });
  }
  return [block];
}

function lowerMath(element: Element): ReaderBlock[] {
  const math = tagOf(element) === "math" ? mathmlOf(element) : katexOf(element);
  return math.tex || math.mathml ? [{ type: "math", ...math }] : [];
}

function mediaSources(element: Element): { url: string; mimeType?: string }[] {
  const sources: { url: string; mimeType?: string }[] = [];
  const direct = httpUrl(attr(element, "src"));
  if (direct) {
    sources.push({ url: direct });
  }
  for (const source of Array.from(element.querySelectorAll("source[src]"))) {
    const url = httpUrl(attr(source, "src"));
    const type = attr(source, "type");
    if (url) {
      sources.push({ url, ...(type ? { mimeType: limited(type, 128) } : {}) });
    }
  }
  return sources;
}

function lowerVideo(element: Element, caption?: ReaderInline[]): ReaderBlock[] {
  const sources = mediaSources(element);
  if (sources.length === 0) {
    return [];
  }
  const poster = httpUrl(attr(element, "poster"));
  const width = positiveInt(attr(element, "width"));
  const height = positiveInt(attr(element, "height"));
  return [
    {
      type: "video",
      placement: placementOf(element),
      sources,
      ...(poster ? { poster } : {}),
      ...(width && height ? { width, height } : {}),
      ...(caption ? { caption } : {}),
    },
  ];
}

function lowerAudio(element: Element, caption?: ReaderInline[]): ReaderBlock[] {
  const sources = mediaSources(element);
  return sources.length > 0 ? [{ type: "audio", sources, ...(caption ? { caption } : {}) }] : [];
}

/* ---- figures, embeds, galleries, media-text ---- */

function lowerEmbed(figure: Element, ctx: LowerContext): ReaderBlock[] {
  const provider = attr(figure, "data-kyomi-embed");
  const url = httpUrl(attr(figure, "data-kyomi-url"));
  if (!provider || !url) {
    return [];
  }
  const { caption } = captionOf(directFigcaption(figure), ctx);
  return [
    {
      type: "embed",
      provider: provider as "youtube",
      placement: placementOf(figure),
      url,
      ...(caption ? { caption } : {}),
    },
  ];
}

function galleryImages(container: Element, ctx: LowerContext): ReaderBlock[] {
  const blocks: ReaderBlock[] = [];
  const seen = new Set<Element>();
  for (const img of Array.from(container.querySelectorAll("img"))) {
    if (seen.has(img)) {
      continue;
    }
    const wrapper = img.closest("a");
    const image = imageOf(img, wrapper && container.contains(wrapper) ? wrapper : null);
    if (!image) {
      continue;
    }
    seen.add(img);
    const item = img.closest("figure");
    const caption =
      item && item !== container ? captionOf(directFigcaption(item), ctx).caption : undefined;
    blocks.push({
      type: "figure",
      placement: "content",
      image,
      ...(caption ? { caption } : {}),
    });
  }
  return blocks;
}

function lowerGallery(container: Element, ctx: LowerContext): ReaderBlock[] {
  const layout = attr(container, "data-kyomi-gallery") === "carousel" ? "carousel" : "grid";
  const own = tagOf(container) === "figure" ? directFigcaption(container) : null;
  const caption = own ? captionOf(own, ctx).caption : undefined;
  const figures = galleryImages(container, ctx);
  const placement = placementOf(container);
  for (const figure of figures) {
    if (figure.type === "figure") {
      figure.placement = placement;
      withHint(figure, ctx, { gallery: { layout, ...(caption ? { caption } : {}) } });
    }
  }
  // Every figure of one gallery shares a group object so the figures pass can find its members.
  const group = ctx.hints.get(figures[0]!)?.gallery;
  for (const figure of figures) {
    ctx.hints.set(figure, { ...ctx.hints.get(figure), ...(group ? { gallery: group } : {}) });
  }
  return figures;
}

function lowerMediaText(container: Element, ctx: LowerContext, depth: number): ReaderBlock[] {
  const position = attr(container, "data-kyomi-media-text") === "end" ? "end" : "start";
  const children = Array.from(container.children);
  const mediaElement = children.find(
    (child) => child.querySelector("img") || tagOf(child) === "img",
  );
  const image = mediaElement ? imageOf(mediaElement) : null;
  if (!mediaElement || !image) {
    return lowerChildren(Array.from(container.childNodes), ctx, depth);
  }
  const content = lowerChildren(
    children.filter((child) => child !== mediaElement),
    ctx,
    depth,
  );
  const figure: ReaderBlock = { type: "figure", placement: placementOf(container), image };
  return [withHint(figure, ctx, { mediaText: { position, content } })];
}

function lowerFigure(figure: Element, ctx: LowerContext, depth: number): ReaderBlock[] {
  if (attr(figure, "data-kyomi-embed")) {
    return lowerEmbed(figure, ctx);
  }
  if (role(figure) === "pullquote") {
    const block = pullQuote(figure, ctx);
    return block ? [block] : [];
  }
  const figcaption = directFigcaption(figure);
  const images = figure.querySelectorAll("img");

  if (attr(figure, "data-kyomi-gallery")) {
    return lowerGallery(figure, ctx);
  }
  if (images.length > 1) {
    figure.setAttribute("data-kyomi-gallery", "grid");
    return lowerGallery(figure, ctx);
  }
  if (images.length === 1 && !figure.querySelector("pre, table, video, audio, blockquote")) {
    const link = images[0]!.closest("a");
    const image = imageOf(images[0]!, link && figure.contains(link) ? link : null);
    if (image) {
      const { caption, credit } = captionOf(figcaption, ctx);
      return [
        {
          type: "figure",
          ...pickAnchor(figure, []),
          placement: placementOf(figure),
          image,
          ...(caption ? { caption } : {}),
          ...(credit ? { credit } : {}),
        },
      ];
    }
  }

  const video = figure.querySelector("video");
  const audio = figure.querySelector("audio");
  if ((video || audio) && !figure.querySelector("pre, table, blockquote, img")) {
    const { caption } = captionOf(figcaption, ctx);
    return video ? lowerVideo(video, caption) : lowerAudio(audio!, caption);
  }

  figcaption?.remove();
  const blocks = lowerChildren(Array.from(figure.childNodes), ctx, depth);
  if (figcaption) {
    const { caption } = captionOf(figcaption, ctx);
    if (caption) {
      blocks.push({
        type: "paragraph",
        children: [{ type: "format", format: "emphasis", children: caption }],
      });
    }
  }
  return blocks;
}

/* ---- footnotes ---- */

function removeBackrefs(root: Element): void {
  for (const link of Array.from(root.querySelectorAll("a[href^='#']"))) {
    if (BACKREF_TEXT.test((link.textContent ?? "").trim())) {
      link.remove();
    }
  }
}

function anchorsWithin(element: Element): string[] {
  const ids = [anchorOf(element), ...Array.from(element.querySelectorAll("[id]")).map(anchorOf)];
  return ids.filter((id): id is string => id !== undefined);
}

function pushDefinition(element: Element, anchors: string[], ctx: LowerContext, depth: number) {
  removeBackrefs(element);
  const children = lowerChildren(Array.from(element.childNodes), ctx, depth);
  // Anchors on the body itself are consumed by the reference; leaving them would duplicate ids.
  for (const child of children) {
    delete child.anchor;
  }
  if (children.length > 0) {
    ctx.defs.push({ anchors, presentation: "footnote", children });
  }
}

function lowerFootnoteContainer(container: Element, ctx: LowerContext, depth: number): void {
  const lists = (
    ["ol", "ul"].includes(tagOf(container))
      ? [container]
      : Array.from(container.querySelectorAll("ol, ul"))
  ).filter((list) => {
    const outer = list.parentElement?.closest("li");
    return !outer || !container.contains(outer);
  });
  for (const list of lists) {
    for (const item of Array.from(list.children).filter((child) => tagOf(child) === "li")) {
      pushDefinition(item, anchorsWithin(item), ctx, depth);
    }
  }
  if (lists.length > 0) {
    return;
  }
  for (const child of Array.from(container.children)) {
    const tag = tagOf(child);
    if (
      tag === "hr" ||
      (HEADING.test(tag) && FOOTNOTES_TITLE.test((child.textContent ?? "").trim()))
    ) {
      continue;
    }
    pushDefinition(child, anchorsWithin(child), ctx, depth);
  }
}

function lowerFootnote(element: Element, ctx: LowerContext, depth: number): void {
  const anchors = anchorsWithin(element);
  for (const child of Array.from(element.children)) {
    if (tagOf(child) === "a" && NUMERIC_LABEL.test((child.textContent ?? "").trim())) {
      child.remove();
    }
  }
  pushDefinition(element, anchors, ctx, depth);
}

/* ---- dispatch ---- */

function lowerBlockElement(element: Element, ctx: LowerContext, depth: number): ReaderBlock[] {
  if (depth > MAX_DEPTH) {
    return [htmlBlock(element, "max-depth")];
  }
  const tag = tagOf(element);
  const kind = role(element);

  if (kind === "footnotes") {
    lowerFootnoteContainer(element, ctx, depth);
    return [];
  }
  if (kind === "footnote") {
    lowerFootnote(element, ctx, depth);
    return [];
  }
  if (kind === "bookmark") {
    return lowerBookmark(element);
  }
  if (kind === "pullquote" && tag !== "figure" && tag !== "blockquote") {
    const block = pullQuote(element, ctx);
    return block ? [block] : [];
  }
  const callout = attr(element, "data-kyomi-callout");
  if (callout) {
    return lowerCallout(element, callout, ctx, depth);
  }
  if (attr(element, "data-kyomi-media-text")) {
    return lowerMediaText(element, ctx, depth);
  }
  if (attr(element, "data-kyomi-gallery") && tag !== "figure") {
    return lowerGallery(element, ctx);
  }

  const heading = HEADING.exec(tag);
  if (heading) {
    const anchors: string[] = [];
    const children = lowerInlines(Array.from(element.childNodes), { ctx, anchors });
    return isBlank(children)
      ? []
      : [
          {
            type: "heading",
            ...pickAnchor(element, anchors),
            level: Number(heading[1]) as 2,
            children,
          },
        ];
  }

  switch (tag) {
    case "p": {
      const block = lowerRun(Array.from(element.childNodes), ctx, element);
      if (kind === "caption" || kind === "credit") {
        for (const entry of block) {
          if (entry.type === "paragraph") {
            withHint(entry, ctx, { role: kind });
          }
        }
      }
      return block;
    }
    case "ul":
    case "ol":
      return lowerList(element, ctx, depth);
    case "blockquote":
      return lowerBlockquote(element, ctx, depth);
    case "pre":
      return lowerCode(element, ctx);
    case "hr":
      return [{ type: "divider" }];
    case "table":
      return lowerTable(element, ctx, depth);
    case "figure":
      return lowerFigure(element, ctx, depth);
    case "details":
      return lowerDetails(element, ctx, depth);
    case "dl":
      return lowerDefinitionList(element, ctx, depth);
    case "video":
      return lowerVideo(element);
    case "audio":
      return lowerAudio(element);
    case "math":
      return lowerMath(element);
    case "figcaption": {
      const { caption } = captionOf(element, ctx);
      return caption ? [{ type: "paragraph", children: caption }] : [];
    }
    default: {
      if (
        isElement(element) &&
        (attr(element, "class") ?? "").split(/\s+/).includes("katex-display")
      ) {
        return lowerMath(element);
      }
      // Structural wrapper (div, section, article, aside, …): its content is the block.
      const anchors = anchorOf(element);
      const children = lowerChildren(Array.from(element.childNodes), ctx, depth);
      if (anchors && children[0] && children[0].anchor === undefined) {
        children[0].anchor = anchors;
      }
      return children;
    }
  }
}

function lowerBookmark(element: Element): ReaderBlock[] {
  const link = element.querySelector("a[href]");
  const url = httpUrl(link ? attr(link, "href") : null);
  if (!url) {
    return [];
  }
  const paragraphs = Array.from(element.querySelectorAll("p")).map((p) =>
    collapse(p.textContent ?? "").trim(),
  );
  const title = collapse(link?.textContent ?? "").trim();
  const img = element.querySelector("img");
  const image = img ? imageOf(img) : null;
  return [
    {
      type: "linkCard",
      url,
      ...(title ? { title } : {}),
      ...(paragraphs[0] ? { description: paragraphs[0] } : {}),
      ...(paragraphs[1] ? { siteName: paragraphs[1] } : {}),
      ...(image ? { image } : {}),
    },
  ];
}

function lowerCallout(
  element: Element,
  variant: string,
  ctx: LowerContext,
  depth: number,
): ReaderBlock[] {
  const titleElement = Array.from(element.querySelectorAll("[data-kyomi-role]")).find(
    (candidate) => role(candidate) === "callout-title",
  );
  const title = titleElement
    ? lowerInlines(Array.from(titleElement.childNodes), { ctx, anchors: [] })
    : [];
  titleElement?.remove();
  element.removeAttribute("data-kyomi-callout");
  const children = lowerChildren(Array.from(element.childNodes), ctx, depth);
  return [
    {
      type: "callout",
      ...pickAnchor(element, []),
      variant: variant as "note",
      ...(isBlank(title) ? {} : { title }),
      children,
    },
  ];
}

/** Lowers sanitized article HTML to KDM blocks, collecting footnote bodies into `ctx.defs`. */
export function lowerHtml(root: Element, ctx: LowerContext): ReaderBlock[] {
  return lowerChildren(Array.from(root.childNodes), ctx, 0);
}
