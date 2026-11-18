import { removeScriptsAndStyles, stripTagMarkup } from "../lib/text-scan";

/**
 * The shape an article may have before it is parsed. The DOM parser and every pass walk the tree
 * recursively, so a body nested tens of thousands deep overflows the stack after seconds of work
 * and one with hundreds of thousands of elements holds the thread for as long. Real articles nest a
 * few dozen levels and hold a few thousand elements; a body past these limits is read as text.
 */
export const MAX_NESTING_DEPTH = 256;
export const MAX_ELEMENTS = 50_000;
/** The text of a body past the budget is cut into at most this many paragraphs. */
const MAX_FALLBACK_PARAGRAPHS = 2_000;

const VOID = [
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
];
/** Elements whose end tag may be left out: the next one closes them, so they do not nest. */
const IMPLIED_END = [
  "p",
  "li",
  "dt",
  "dd",
  "tr",
  "td",
  "th",
  "option",
  "optgroup",
  "thead",
  "tbody",
  "tfoot",
  "colgroup",
  "rt",
  "rp",
  "html",
  "head",
  "body",
];
const NON_NESTING: ReadonlySet<string> = new Set([...VOID, ...IMPLIED_END]);

const isNameChar = (code: number) =>
  (code >= 97 && code <= 122) ||
  (code >= 65 && code <= 90) ||
  (code >= 48 && code <= 57) ||
  code === 45 ||
  code === 58;

type Tag = { name: string; closing: boolean; selfClosing: boolean; end: number };

/** The tag whose `<` is at `from`, or null when what follows is not a tag. */
function readTag(html: string, from: number): Tag | null {
  const closing = html.charCodeAt(from + 1) === 47; /* / */
  const nameStart = from + (closing ? 2 : 1);
  let nameEnd = nameStart;
  while (nameEnd < html.length && isNameChar(html.charCodeAt(nameEnd))) {
    nameEnd += 1;
  }
  if (nameEnd === nameStart) {
    return null;
  }
  const close = html.indexOf(">", nameEnd);
  return {
    name: html.slice(nameStart, nameEnd).toLowerCase(),
    closing,
    selfClosing: close !== -1 && html.charCodeAt(close - 1) === 47 /* / */,
    end: close === -1 ? html.length : close,
  };
}

/** Where the scan resumes after a `<!` declaration or comment. */
function skipDeclaration(html: string, from: number): number {
  const close = html.startsWith("<!--", from)
    ? html.indexOf("-->", from + 4)
    : html.indexOf(">", from + 2);
  return close === -1 ? html.length : close;
}

/**
 * Whether `html` is within the depth and element limits. One linear pass over the tag openings: an
 * estimate (an unbalanced body is read as the browser would only after parsing it), kept on the
 * safe side for ordinary markup by not counting void elements or those whose end tag is optional.
 */
export function isWithinStructureBudget(html: string): boolean {
  let depth = 0;
  let elements = 0;
  let from = html.indexOf("<");
  while (from !== -1) {
    let next = from + 1;
    const tag = readTag(html, from);
    if (tag) {
      if (!tag.closing) {
        elements += 1;
      }
      if (!NON_NESTING.has(tag.name)) {
        depth = Math.max(0, depth + (tag.closing ? -1 : tag.selfClosing ? 0 : 1));
      }
      if (depth > MAX_NESTING_DEPTH || elements > MAX_ELEMENTS) {
        return false;
      }
      next = tag.end;
    } else if (html.charCodeAt(from + 1) === 33 /* ! */) {
      next = skipDeclaration(html, from);
    }
    from = html.indexOf("<", next);
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
