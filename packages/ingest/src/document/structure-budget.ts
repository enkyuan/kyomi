import { removeScriptsAndStyles, stripTagMarkup } from "../lib/text-scan";
import {
  afterDeclaration,
  afterGt,
  isAlpha,
  isEndOfTagSection,
  isWhitespace,
  rawTextElement,
  rawTextEnd,
  readTagBody,
  skipWhitespace,
} from "./tag-scan";

/**
 * The shape an article may have before it is parsed. The DOM parser and every pass walk the tree
 * recursively, so a body nested tens of thousands deep overflows the stack after seconds of work
 * and one with hundreds of thousands of elements holds the thread for as long. Real articles nest a
 * few dozen levels and hold a few thousand elements; a body past these limits is read as text.
 */
export const MAX_NESTING_DEPTH = 256;
export const MAX_ELEMENTS = 50_000;
/**
 * The sum of every element's depth. Anything that walks an element's ancestors (the sanitizer's
 * clone and append, `closest`) costs this much in total, so the two limits above are not enough:
 * 255 levels under 40,000 elements is legal for each and cost eight seconds together. Real
 * articles average a depth of ten or so, which leaves a body of 50,000 elements room to average 20.
 */
export const MAX_DEPTH_SUM = 1_000_000;
/**
 * Attributes on one element, and on all of them. The sanitizer compares each attribute of an
 * element with the ones before it, so one tag with tens of thousands of attribute names costs
 * seconds. No real element carries a few hundred.
 */
export const MAX_ATTRIBUTES_PER_ELEMENT = 256;
export const MAX_ATTRIBUTES = 200_000;
/** The text of a body past the budget is cut into at most this many paragraphs. */
const MAX_FALLBACK_PARAGRAPHS = 2_000;

/**
 * What the parser (`linkedom`, which is `htmlparser2` in HTML mode) does with a body, replayed
 * without building a tree. Depth cannot be estimated from the tag text: `<div/>` opens, `</x>` closes
 * nothing, `<!-->` is a whole comment, `<p_>` is not `<p>`, a `>` may sit inside an attribute value,
 * and what follows `<script>` is text. Each of those once let a few hundred kilobytes of `<div>`
 * through to a stack overflow, so this follows the tokenizer state by state and the parser's open
 * element stack exactly. It stops at the first limit, so the work is bounded by the limits
 * (a close tag searches at most {@link MAX_NESTING_DEPTH} open elements), not by how hostile the
 * input is. `structure-budget.test.ts` replays generated markup against the real parser.
 */
const VOID: ReadonlySet<string> = new Set([
  "area",
  "base",
  "basefont",
  "br",
  "col",
  "command",
  "embed",
  "frame",
  "hr",
  "img",
  "input",
  "isindex",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
const P = new Set(["p"]);
const FORM = new Set(["input", "option", "optgroup", "select", "button", "datalist", "textarea"]);
const SECTION = new Set(["thead", "tbody"]);
const DEFINITION = new Set(["dd", "dt"]);
const RUBY = new Set(["rt", "rp"]);
/** An opening tag closes the open elements named here, but only while they are the innermost. */
const IMPLIED_CLOSE: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["tr", new Set(["tr", "th", "td"])],
  ["th", new Set(["th"])],
  ["td", new Set(["thead", "th", "td"])],
  ["body", new Set(["head", "link", "script"])],
  ["li", new Set(["li"])],
  ["p", P],
  ...["h1", "h2", "h3", "h4", "h5", "h6"].map((name): [string, ReadonlySet<string>] => [name, P]),
  ["select", FORM],
  ["input", FORM],
  ["output", FORM],
  ["button", FORM],
  ["datalist", FORM],
  ["textarea", FORM],
  ["option", new Set(["option"])],
  ["optgroup", new Set(["optgroup", "option"])],
  ["dd", DEFINITION],
  ["dt", DEFINITION],
  ...[
    "address",
    "article",
    "aside",
    "blockquote",
    "details",
    "div",
    "dl",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "form",
    "header",
    "hr",
    "main",
    "nav",
    "ol",
    "pre",
    "section",
    "table",
    "ul",
  ].map((name): [string, ReadonlySet<string>] => [name, P]),
  ["rt", RUBY],
  ["rp", RUBY],
  ["tbody", SECTION],
  ["tfoot", SECTION],
]);
/** Elements after which a self-closing `/>` is honoured, and the ones that end that. */
const FOREIGN: ReadonlySet<string> = new Set(["math", "svg"]);
const INTEGRATION: ReadonlySet<string> = new Set([
  "mi",
  "mo",
  "mn",
  "ms",
  "mtext",
  "annotation-xml",
  "foreignobject",
  "desc",
  "title",
]);

const BANG = 33;
const QUESTION = 63;
const SLASH = 47;
const GT = 62;

/** How much of each limit a body uses. `exceeded` means the scan stopped at the first one it passed. */
export type StructureMeasure = {
  exceeded: boolean;
  /** The deepest element, the outermost being 1. */
  depth: number;
  elements: number;
  depthSum: number;
  attributes: number;
};

export function measureStructure(html: string): StructureMeasure {
  const length = html.length;
  const measure: StructureMeasure = {
    exceeded: false,
    depth: 0,
    elements: 0,
    depthSum: 0,
    attributes: 0,
  };
  /** Open elements, innermost last. Void elements are never on it. */
  const open: string[] = [];
  /** Whether each `svg`, `math` or integration point still open reads `/>` as the end of the tag. */
  const foreign: boolean[] = [false];

  const exceed = () => {
    measure.exceeded = true;
  };

  /** An element is in the tree: the parent is the innermost open element. */
  const element = (name: string, attributes: number) => {
    const depth = open.length + (VOID.has(name) ? 1 : 0);
    measure.elements += 1;
    measure.depthSum += depth;
    measure.attributes += attributes;
    measure.depth = Math.max(measure.depth, depth);
    if (
      depth > MAX_NESTING_DEPTH ||
      measure.elements > MAX_ELEMENTS ||
      measure.depthSum > MAX_DEPTH_SUM ||
      attributes > MAX_ATTRIBUTES_PER_ELEMENT ||
      measure.attributes > MAX_ATTRIBUTES
    ) {
      exceed();
    }
  };

  /** The tag name has been read: what it closes, then it opens. */
  const openName = (name: string) => {
    const closes = IMPLIED_CLOSE.get(name);
    if (closes) {
      while (open.length > 0 && closes.has(open[open.length - 1] as string)) {
        open.pop();
      }
    }
    if (!VOID.has(name)) {
      open.push(name);
      if (FOREIGN.has(name)) {
        foreign.push(true);
      } else if (INTEGRATION.has(name)) {
        foreign.push(false);
      }
    }
  };

  const closeTag = (name: string) => {
    if (FOREIGN.has(name) || INTEGRATION.has(name)) {
      foreign.pop();
    }
    if (!VOID.has(name)) {
      const position = open.lastIndexOf(name);
      if (position !== -1) {
        open.length = position;
      } else if (name === "p") {
        // A stray `</p>` is an empty paragraph.
        openName("p");
        element("p", 0);
        open.pop();
      }
    } else if (name === "br") {
      element("br", 0);
    }
  };

  const afterClosingTag = (at: number) => {
    const index = skipWhitespace(html, at + 2);
    const code = html.charCodeAt(index);
    if (code === GT) {
      return index + 1;
    }
    if (!isAlpha(code)) {
      return afterGt(html, index + 1);
    }
    let end = index + 1;
    while (end < length && html.charCodeAt(end) !== GT && !isWhitespace(html.charCodeAt(end))) {
      end += 1;
    }
    if (end >= length) {
      return length;
    }
    closeTag(html.slice(index, end).toLowerCase());
    return afterGt(html, end);
  };

  /** After `<` and a letter: the name, the attributes, then how the tag ends. */
  const afterOpeningTag = (at: number) => {
    let nameEnd = at + 2;
    while (nameEnd < length && !isEndOfTagSection(html.charCodeAt(nameEnd))) {
      nameEnd += 1;
    }
    if (nameEnd >= length) {
      return length;
    }
    const name = html.slice(at + 1, nameEnd).toLowerCase();
    const raw = rawTextElement(html, at + 1, nameEnd);
    openName(name);
    const tag = readTagBody(html, nameEnd, MAX_ATTRIBUTES_PER_ELEMENT);
    if (tag.attributes > MAX_ATTRIBUTES_PER_ELEMENT) {
      exceed();
      return length;
    }
    // A tag the input ends inside is dropped by the parser.
    if (tag.ending === "unterminated") {
      return length;
    }
    element(name, tag.attributes);
    if (tag.ending === "selfClosing") {
      // Outside svg and math the slash is ignored and the element stays open.
      if (foreign[foreign.length - 1] === true && open[open.length - 1] === name) {
        open.pop();
      }
      return tag.end + 1;
    }
    if (raw === null) {
      return tag.end + 1;
    }
    // The text of a raw text element ends at its own end tag.
    const textEnd = rawTextEnd(html, tag.end + 1, raw);
    if (textEnd === -1) {
      return length;
    }
    closeTag(raw);
    return afterGt(html, textEnd);
  };

  let at = html.indexOf("<");
  while (at !== -1 && !measure.exceeded) {
    const code = html.charCodeAt(at + 1);
    let next = at + 1;
    if (code === BANG) {
      next = afterDeclaration(html, at);
    } else if (code === QUESTION) {
      next = afterGt(html, at + 2);
    } else if (code === SLASH) {
      next = afterClosingTag(at);
    } else if (isAlpha(code)) {
      next = afterOpeningTag(at);
    }
    at = next >= length ? -1 : html.indexOf("<", next);
  }
  return measure;
}

/** Whether `html` is within every limit, without building the tree the parser would. */
export function isWithinStructureBudget(html: string): boolean {
  return !measureStructure(html).exceeded;
}

/**
 * Whether a parsed tree is within the same limits. The scan above is exact for the parser it was
 * written against; this walks what the parser actually built, without recursing, so a parser that
 * reads a body differently after an upgrade still cannot hand the passes a tree they cannot take.
 * It follows elements only: after a doctype a document's child nodes are not linked as siblings.
 */
export function isTreeWithinStructureBudget(root: ParentNode): boolean {
  let elements = 0;
  let depthSum = 0;
  /** Ancestors of `node` below `root`. */
  let depth = 0;
  let node = root.firstElementChild;
  while (node) {
    elements += 1;
    depthSum += depth + 1;
    if (depth + 1 > MAX_NESTING_DEPTH || elements > MAX_ELEMENTS || depthSum > MAX_DEPTH_SUM) {
      return false;
    }
    const child = node.firstElementChild;
    if (child) {
      depth += 1;
      node = child;
      continue;
    }
    let next = node.nextElementSibling;
    while (!next) {
      const parent = node.parentNode;
      if (!parent || parent === root) {
        return true;
      }
      depth -= 1;
      node = parent as Element;
      next = node.nextElementSibling;
    }
    node = next;
  }
  return true;
}

const escapeText = (text: string) => text.replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/**
 * The readable text of a body that failed the budget, as paragraphs: markup removed, scripts and
 * styles dropped, the rest escaped so it cannot become markup again. Entities stay as written, so
 * they still read as the characters they name.
 */
export function textOnlyHtml(html: string): string {
  const lines = stripTagMarkup(removeScriptsAndStyles(html), "\n").split("\n");
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    const text = line.trim();
    if (text) {
      current.push(text);
    } else if (current.length > 0 && paragraphs.length < MAX_FALLBACK_PARAGRAPHS - 1) {
      // Past the cap the rest of the text stays in one last paragraph.
      paragraphs.push(current.join(" "));
      current = [];
    }
  }
  if (current.length > 0) {
    paragraphs.push(current.join(" "));
  }
  return paragraphs.map((text) => `<p>${escapeText(text)}</p>`).join("\n");
}
