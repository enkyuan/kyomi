function hasInlineDollarMath(value: string) {
  const matches = value.matchAll(/(^|[^\\])\$([^$\n]+?)\$/g);
  for (const match of matches) {
    const candidate = match[2]?.trim();
    if (!candidate) {
      continue;
    }
    if (/[\\^_=]/.test(candidate) || /\d\s*[-+*/=]\s*\d/.test(candidate)) {
      return true;
    }
  }
  return false;
}

const LINE_TERMINATOR = /[\n\r\u2028\u2029]/;

/**
 * The delimited-math checks below are single `indexOf` passes. The lazy `[\s\S]+?` regexes they
 * replace rescanned to the end of the text for every opener without a closer, which is quadratic
 * on a hostile article. Only the first opener matters: a later one has fewer closers after it.
 */

/** `open`, at least one character, then `close`. */
function hasPair(value: string, open: string, close: string) {
  const start = value.indexOf(open);
  return start !== -1 && value.indexOf(close, start + open.length + 1) !== -1;
}

/**
 * `$$…$$` where neither delimiter follows a backslash. The closer may also start a line, as
 * `/(^|[^\\])\$\$[\s\S]+?(^|[^\\])\$\$/m` allows.
 */
function hasDisplayDollarMath(value: string) {
  let opener = value.indexOf("$$");
  while (opener > 0 && value[opener - 1] === "\\") {
    opener = value.indexOf("$$", opener + 1);
  }
  if (opener === -1) {
    return false;
  }
  for (
    let closer = value.indexOf("$$", opener + 3);
    closer !== -1;
    closer = value.indexOf("$$", closer + 1)
  ) {
    const before = value[closer - 1] ?? "";
    if ((closer >= opener + 4 && before !== "\\") || LINE_TERMINATOR.test(before)) {
      return true;
    }
  }
  return false;
}

export function hasLikelyDelimitedTex(value: string) {
  return (
    hasDisplayDollarMath(value) ||
    hasPair(value, String.raw`\(`, String.raw`\)`) ||
    hasPair(value, String.raw`\[`, String.raw`\]`) ||
    /\\begin\{[a-zA-Z*]+\}/.test(value)
  );
}

export function hasLikelyMarkdownMath(value: string) {
  return hasLikelyDelimitedTex(value) || hasInlineDollarMath(value);
}
