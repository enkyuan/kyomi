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

export function hasLikelyDelimitedTex(value: string) {
  return (
    /(^|[^\\])\$\$[\s\S]+?(^|[^\\])\$\$/m.test(value) ||
    /\\\([\s\S]+?\\\)/.test(value) ||
    /\\\[[\s\S]+?\\\]/.test(value) ||
    /\\begin\{[a-zA-Z*]+\}/.test(value)
  );
}

export function hasLikelyMarkdownMath(value: string) {
  return hasLikelyDelimitedTex(value) || hasInlineDollarMath(value);
}
