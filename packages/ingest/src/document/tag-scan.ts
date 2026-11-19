/**
 * Where each construct of an HTML body ends, as the tokenizer of `htmlparser2` (the parser behind
 * `linkedom`) reads it in HTML mode. `structure-budget` builds its replay of the parser on these.
 * They follow the tokenizer's states, quirks included, because the point is to agree with it: a
 * comment that ends at `<!-->`, a `>` inside a quoted attribute value, the text of a `<script>`.
 * Entities are not followed: what one consumes is letters and digits, which end nothing here.
 */

const TAB = 9;
const LF = 10;
const FF = 12;
const CR = 13;
const SPACE = 32;
const DOUBLE_QUOTE = 34;
const SINGLE_QUOTE = 39;
const DASH = 45;
const SLASH = 47;
const LT = 60;
const EQ = 61;
const GT = 62;
const OPEN_BRACKET = 91;
const CLOSE_BRACKET = 93;
const CDATA = "CDATA[";

export const isWhitespace = (code: number) =>
  code === SPACE || code === LF || code === TAB || code === FF || code === CR;
export const isEndOfTagSection = (code: number) =>
  code === SLASH || code === GT || isWhitespace(code);
export const isAlpha = (code: number) => (code >= 97 && code <= 122) || (code >= 65 && code <= 90);

export function skipWhitespace(html: string, from: number): number {
  let index = from;
  while (isWhitespace(html.charCodeAt(index))) {
    index += 1;
  }
  return index;
}

/** Where scanning resumes after a construct that ends at the first `>` from `from`. */
export function afterGt(html: string, from: number): number {
  const close = html.indexOf(">", from);
  return close === -1 ? html.length : close + 1;
}

/** `-->` or `]]>`, which `first` starts; `matched` characters of it are already behind `from`. */
function afterCommentLike(html: string, from: number, first: number, matched: number): number {
  const sequence = [first, first, GT];
  let seen = matched;
  for (let index = from; index < html.length; index += 1) {
    const code = html.charCodeAt(index);
    if (code === sequence[seen]) {
      seen += 1;
      if (seen === 3) {
        return index + 1;
      }
    } else if (seen === 0) {
      const next = html.indexOf(String.fromCharCode(first), index + 1);
      if (next === -1) {
        return html.length;
      }
      index = next;
      seen = 1;
    } else if (code !== sequence[seen - 1]) {
      // Long sequences such as `--->` still end the comment.
      seen = 0;
    }
  }
  return html.length;
}

/** After `<!` at `at`: a comment, CDATA, or a declaration that ends at the next `>`. */
export function afterDeclaration(html: string, at: number): number {
  const code = html.charCodeAt(at + 2);
  if (code === OPEN_BRACKET) {
    for (let index = 0; index < CDATA.length; index += 1) {
      if (html.charCodeAt(at + 3 + index) !== CDATA.charCodeAt(index)) {
        return afterGt(html, at + 3 + index);
      }
    }
    return afterCommentLike(html, at + 3 + CDATA.length, CLOSE_BRACKET, 0);
  }
  if (code === DASH) {
    // `<!-->` and `<!--->` are whole comments.
    return html.charCodeAt(at + 3) === DASH
      ? afterCommentLike(html, at + 4, DASH, 2)
      : afterGt(html, at + 4);
  }
  return afterGt(html, at + 3);
}

/** How a tag ends: at `>`, at `/>`, or because the input does. */
export type TagBody = {
  ending: "open" | "selfClosing" | "unterminated";
  end: number;
  attributes: number;
};

/**
 * The attributes of a tag whose name ends at `from`. `end` is the index of the closing `>`.
 * Reading stops once a tag holds more than `limit` attribute names.
 */
export function readTagBody(html: string, from: number, limit: number): TagBody {
  const length = html.length;
  let index = from;
  let attributes = 0;
  while (attributes <= limit) {
    index = skipWhitespace(html, index);
    const code = html.charCodeAt(index);
    if (index >= length) {
      break;
    }
    if (code === GT) {
      return { ending: "open", end: index, attributes };
    }
    if (code === SLASH) {
      index = skipWhitespace(html, index + 1);
      if (html.charCodeAt(index) === GT) {
        return { ending: "selfClosing", end: index, attributes };
      }
      continue;
    }
    // The first character of a name is taken whatever it is, `=` included.
    attributes += 1;
    index += 1;
    while (
      index < length &&
      html.charCodeAt(index) !== EQ &&
      !isEndOfTagSection(html.charCodeAt(index))
    ) {
      index += 1;
    }
    index = skipWhitespace(html, index);
    if (html.charCodeAt(index) !== EQ) {
      continue;
    }
    index = skipWhitespace(html, index + 1);
    const quote = html.charCodeAt(index);
    if (quote === DOUBLE_QUOTE || quote === SINGLE_QUOTE) {
      const close = html.indexOf(quote === DOUBLE_QUOTE ? '"' : "'", index + 1);
      if (close === -1) {
        break;
      }
      index = close + 1;
    } else {
      while (
        index < length &&
        !isWhitespace(html.charCodeAt(index)) &&
        html.charCodeAt(index) !== GT
      ) {
        index += 1;
      }
    }
  }
  return { ending: "unterminated", end: length, attributes };
}

/**
 * The raw text element whose name is the `start` to `end` of a tag, or null. The tokenizer reads
 * the first two letters loosely, so `<tmp>` is an `<xmp>` and `<xitle>` is a `<title>`.
 */
export function rawTextElement(html: string, start: number, end: number): string | null {
  const first = html.charCodeAt(start) | 32;
  const second = html.charCodeAt(start + 1) | 32;
  let name: string | null = null;
  if (first === 115 /* s */) {
    name = second === 99 /* c */ ? "script" : second === 116 /* t */ ? "style" : null;
  } else if (first === 116 /* t */ || first === 120 /* x */) {
    name =
      second === 105 /* i */
        ? "title"
        : second === 101 /* e */
          ? "textarea"
          : second === 109 /* m */
            ? "xmp"
            : null;
  }
  if (name === null || end - start !== name.length) {
    return null;
  }
  for (let index = 2; index < name.length; index += 1) {
    if ((html.charCodeAt(start + index) | 32) !== name.charCodeAt(index)) {
      return null;
    }
  }
  return name;
}

/**
 * Where the text of a raw text element ends: the index of the `>` or whitespace after `</name`,
 * or -1 when the input ends first.
 */
export function rawTextEnd(html: string, from: number, name: string): number {
  const sequence = `</${name}`;
  let seen = 0;
  for (let index = from; index < html.length; index += 1) {
    const code = html.charCodeAt(index);
    if (seen === sequence.length) {
      if (code === GT || isWhitespace(code)) {
        return index;
      }
      seen = 0;
    }
    if ((code | 32) === sequence.charCodeAt(seen)) {
      seen += 1;
    } else if (seen > 0) {
      seen = code === LT ? 1 : 0;
    } else if (name !== "title") {
      // Anything but a title can skip to the next `<`; a title also decodes entities.
      const next = html.indexOf("<", index + 1);
      if (next === -1) {
        return -1;
      }
      index = next;
      seen = 1;
    }
  }
  return -1;
}
