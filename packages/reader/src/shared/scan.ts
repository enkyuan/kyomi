/**
 * Forward-only scans for untrusted markup. A lazy `[\s\S]*?` between two markers rescans to the end
 * of the text for every opener that has no closer, which is quadratic on a hostile article
 * (`<script ` repeated, never closed). Here a missing closer ends the scan: a later opener has a
 * subset of the text after it, so it cannot find one either.
 */

/** First match of the global regex `pattern` at or after `from`. */
function execFrom(pattern: RegExp, text: string, from: number): RegExpExecArray | null {
  pattern.lastIndex = from;
  return pattern.exec(text);
}

/**
 * Replaces every `open … close` span with `replace(inner)`, matching what
 * `/open[^>]*>[\s\S]*?close/g` (with `skipTag`) or `/open[\s\S]*?close/g` (without) would replace.
 * `open` and `close` are global regexes for fixed text (`/<script\b/gi`), never open-ended ones.
 */
export function replaceSpans(
  text: string,
  { open, close, skipTag = false }: { open: RegExp; close: RegExp; skipTag?: boolean },
  replace: (inner: string) => string,
): string {
  let out = "";
  let cursor = 0;
  let start = execFrom(open, text, 0);
  while (start) {
    let innerStart = start.index + start[0].length;
    if (skipTag) {
      const tagEnd = text.indexOf(">", innerStart);
      if (tagEnd === -1) {
        break;
      }
      innerStart = tagEnd + 1;
    }
    const end = execFrom(close, text, innerStart);
    if (!end) {
      break;
    }
    out += text.slice(cursor, start.index) + replace(text.slice(innerStart, end.index));
    cursor = end.index + end[0].length;
    start = execFrom(open, text, cursor);
  }
  return out + text.slice(cursor);
}
