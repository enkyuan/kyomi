/**
 * Linear scans over untrusted markup and prose. Feed XML/HTML from publishers and clip bodies from
 * signed-in users run on one thread, so no scan here may rescan to the end of the input for every
 * unterminated opener (`/<[^>]*>/g` over `<` x 100k is quadratic). The rule that keeps these linear:
 * when no `>` (or closing tag) exists after position i, none exists after any later position either,
 * so the scan stops instead of retrying from the next opener.
 */

const GT = 62;
const SLASH = 47;

/** Whitespace, "/" or ">": what ends a tag name, so `<head` is not `<header` and `<link` not `<linkedin`. */
function endsTagName(code: number): boolean {
  return code === GT || code === SLASH || code === 32 || (code >= 9 && code <= 13);
}

/** ASCII case-insensitive compare of the lower-case `name` at `start`. */
function nameAt(text: string, start: number, name: string): boolean {
  for (let index = 0; index < name.length; index += 1) {
    if ((text.charCodeAt(start + index) | 32) !== name.charCodeAt(index)) {
      return false;
    }
  }
  return endsTagName(text.charCodeAt(start + name.length));
}

/** Index of the next `<name` opener at or after `from`, or -1. `name` is lower-case ASCII. */
export function indexOfOpenTag(text: string, name: string, from = 0): number {
  let index = text.indexOf("<", from);
  while (index !== -1 && !nameAt(text, index + 1, name)) {
    index = text.indexOf("<", index + 1);
  }
  return index;
}

/** Index of the next `</name` closer at or after `from`, or -1. `name` is lower-case ASCII. */
export function indexOfCloseTag(text: string, name: string, from = 0): number {
  let index = text.indexOf("</", from);
  while (index !== -1 && !nameAt(text, index + 2, name)) {
    index = text.indexOf("</", index + 2);
  }
  return index;
}

/** Every `<name ...>` tag, from `<` through the first `>`. A tag with no `>` ends the scan. */
export function* openTags(text: string, name: string): Generator<string> {
  let open = indexOfOpenTag(text, name);
  while (open !== -1) {
    const end = text.indexOf(">", open + 1 + name.length);
    if (end === -1) {
      return;
    }
    yield text.slice(open, end + 1);
    open = indexOfOpenTag(text, name, end + 1);
  }
}

/** The markup between the first `<name ...>` and the next `</name>`, or null when either is missing. */
export function elementInner(text: string, name: string): string | null {
  const open = indexOfOpenTag(text, name);
  const tagEnd = open === -1 ? -1 : text.indexOf(">", open + 1 + name.length);
  if (tagEnd === -1) {
    return null;
  }
  const close = indexOfCloseTag(text, name, tagEnd + 1);
  return close === -1 ? null : text.slice(tagEnd + 1, close);
}

/** `<[^>]*>` replaced by `replacement`. A `<` with no `>` after it stays as text. */
export function stripTagMarkup(text: string, replacement = " "): string {
  let result = "";
  let position = 0;
  let open = text.indexOf("<");
  while (open !== -1) {
    const close = text.indexOf(">", open + 1);
    if (close === -1) {
      break;
    }
    result += text.slice(position, open) + replacement;
    position = close + 1;
    open = text.indexOf("<", position);
  }
  return position === 0 ? text : result + text.slice(position);
}

/**
 * Replaces each `<name ...>...</name>` element with `replacement`. An element with no closing tag runs
 * to the end of the input, as it does in a browser; a `<name` with no `>` is not a tag at all.
 */
export function removeElements(text: string, name: string, replacement = " "): string {
  let result = "";
  let position = 0;
  let open = indexOfOpenTag(text, name);
  while (open !== -1) {
    const tagEnd = text.indexOf(">", open + 1 + name.length);
    if (tagEnd === -1) {
      break;
    }
    result += text.slice(position, open) + replacement;
    const close = indexOfCloseTag(text, name, tagEnd + 1);
    if (close === -1) {
      return result;
    }
    const closeEnd = text.indexOf(">", close + 2 + name.length);
    if (closeEnd === -1) {
      return result;
    }
    position = closeEnd + 1;
    open = indexOfOpenTag(text, name, position);
  }
  return position === 0 ? text : result + text.slice(position);
}

export function removeScriptsAndStyles(text: string): string {
  return removeElements(removeElements(text, "script"), "style");
}

/**
 * The last capture of `pattern` (global) in one tag. The `<img[^>]+src=` regexes this replaces
 * were greedy, so `<img data-src="a" src="b">` resolved to `b`.
 */
function lastCapture(tag: string, pattern: RegExp): string | null {
  let capture: string | null = null;
  for (const match of tag.matchAll(pattern)) {
    capture = match[1] ?? capture;
  }
  return capture;
}

const META_CONTENT = /\bcontent\s*=\s*["']([^"']+)["']/gi;
const IMG_SRC = /\bsrc\s*=\s*["']([^"']+)["']/gi;

/** `content` of the first `<meta>` whose `attribute` (`property` or `name`) equals `key`. */
export function metaContent(
  html: string,
  attribute: "property" | "name",
  key: string,
): string | null {
  const keyPattern = new RegExp(`\\b${attribute}\\s*=\\s*["']${key}["']`, "i");
  for (const tag of openTags(html, "meta")) {
    if (keyPattern.test(tag)) {
      const content = lastCapture(tag, META_CONTENT);
      if (content) {
        return content;
      }
    }
  }
  return null;
}

/** `src` of the first `<img>` that has one. */
export function firstImageSrc(html: string): string | null {
  for (const tag of openTags(html, "img")) {
    const src = lastCapture(tag, IMG_SRC);
    if (src) {
      return src;
    }
  }
  return null;
}

const HEAD_SCAN_LIMIT = 256 * 1024;
const HEAD_FALLBACK_CHARS = 32 * 1024;

/**
 * The `<head>` contents of an HTML page, or its first 32 KiB when there is no closed head. Only the
 * first 256 KiB of the document is scanned, so a hostile page cannot make this cost more.
 */
export function extractHeadHtml(body: string): string {
  const scanned = body.length > HEAD_SCAN_LIMIT ? body.slice(0, HEAD_SCAN_LIMIT) : body;
  return elementInner(scanned, "head") ?? scanned.slice(0, HEAD_FALLBACK_CHARS);
}

const TAG_START = /<[a-z]/i;

/** A `<` followed by a letter and a later `>`: exactly `/<[a-z][\s\S]*>/i`, without the rescans. */
export function looksLikeHtml(value: string): boolean {
  const start = TAG_START.exec(value);
  return start !== null && value.indexOf(">", start.index + 2) !== -1;
}

/** HTML that is only wrapper tags around raw markdown, with no structural tags rendered yet. */
export function htmlLooksLikeWrappedMarkdown(value: string): boolean {
  return !/<(h[1-6]|ul|ol|li|blockquote|pre|table|thead|tbody|tr|th|td|hr|code)\b/i.test(value);
}

/** Only this much of a body is scored; length thresholds still use the full length. */
const MARKDOWN_SCAN_CHARS = 32_000;

// Line anchors are `^` under the `m` flag with `[ \t]` indentation: a `\s*` after `(^|\n)` can cross
// newlines, which makes runs of blank lines quadratic. `[^\[\]]` and `[^)\s[]` stop a link label or
// URL at the next bracket, so one `[` cannot rescan every `[` after it.
const FENCE = /^[ \t]*```[\w-]*\n[\s\S]*?\n[ \t]*```/m;
const LIST = /^[ \t]{0,3}(?:[-*+]\s+|\d+[.)]\s+)/m;
const QUOTE = /^[ \t]{0,3}>[^\n]+/m;
const HEADING = /^[ \t]{0,3}#{1,6}\s+\S/m;
const SETEXT = /(?<![^\n])[^\n]+\n(?:=+|-{3,})\s*($|\n)/m;
const TABLE = /^[ \t]*\|.+\|[ \t\r]*\n(?:[ \t\r]*\n)*[ \t]*\|[-:\s|]+\|/m;
const LINK = /\[[^[\]]+\]\(([^)\s[]+)(?:\s+"[^"]*")?\)/;
const IMAGE = /!\[[^[\]]*]\(([^)\s[]+)(?:\s+"[^"]*")?\)/;
const INLINE_CODE = /`[^`\n]{1,140}`/;
const RULE = /^[ \t]*[-*_]{3,}\s*($|\n)/m;
const STRIKETHROUGH = /~~[^~\n]+~~/;
const INLINE_MATH = /\$[^$\n]+\$/;

type Signal = readonly [pattern: RegExp, weight: number];

const SIGNALS: readonly Signal[] = [
  [FENCE, 7],
  [LIST, 4],
  [QUOTE, 3],
  [HEADING, 4],
  [SETEXT, 4],
  [TABLE, 6],
  [LINK, 4],
  [IMAGE, 4],
  [INLINE_CODE, 3],
  [RULE, 2],
];
const STRIKE_AND_MATH_SIGNALS: readonly Signal[] = [
  [STRIKETHROUGH, 1],
  [INLINE_MATH, 1],
];
const STRUCTURAL_SIGNALS = [HEADING, SETEXT, LIST, RULE];

function scoreSignals(sample: string, signals: readonly Signal[]): number {
  return signals.reduce(
    (total, [pattern, weight]) => total + (pattern.test(sample) ? weight : 0),
    0,
  );
}

/**
 * Whether prose reads as markdown. `strikeAndMath` adds the `~~strike~~` and `$math$` signals the
 * reader pipeline scores but feed ingest does not.
 */
export function looksLikeMarkdown(value: string, options?: { strikeAndMath?: boolean }): boolean {
  const sample = value.length > MARKDOWN_SCAN_CHARS ? value.slice(0, MARKDOWN_SCAN_CHARS) : value;
  const score =
    scoreSignals(sample, SIGNALS) +
    (options?.strikeAndMath ? scoreSignals(sample, STRIKE_AND_MATH_SIGNALS) : 0);

  if (score >= 6) {
    return true;
  }
  // Long markdown posts can be mostly headings/rules with little inline syntax.
  if (
    value.length > 1800 &&
    score >= 4 &&
    STRUCTURAL_SIGNALS.some((pattern) => pattern.test(sample))
  ) {
    return true;
  }
  // Short technical content often only has inline code or links.
  return score >= 3 && value.length <= 2600;
}
