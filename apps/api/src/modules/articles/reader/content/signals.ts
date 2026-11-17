/** Text heuristics shared by the reader body builders: what a string looks like, not what it is. */

export function normalizeText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function countWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

export function countSentences(value: string): number {
  return (value.match(/[.!?](?=\s|$)/g) ?? []).length;
}

export function looksLikeHtml(value: string): boolean {
  return /<[a-z][\s\S]*>/i.test(value);
}

function markdownSignalScore(value: string): number {
  let score = 0;
  if (/(^|\n)\s*```[\w-]*\n[\s\S]*?\n\s*```/m.test(value)) score += 7;
  if (/(^|\n)\s{0,3}(?:[-*+]\s+|\d+[.)]\s+)/m.test(value)) score += 4;
  if (/(^|\n)\s{0,3}>[^\n]+/m.test(value)) score += 3;
  if (/(^|\n)\s{0,3}#{1,6}\s+\S/m.test(value)) score += 4;
  if (/(^|\n)[^\n]+\n(?:=+|-{3,})\s*($|\n)/m.test(value)) score += 4;
  if (/(^|\n)\s*\|.+\|\s*\n\s*\|[-:\s|]+\|/m.test(value)) score += 6;
  if (/\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/m.test(value)) score += 4;
  if (/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/m.test(value)) score += 4;
  if (/`[^`\n]{1,140}`/.test(value)) score += 3;
  if (/(^|\n)\s*[-*_]{3,}\s*($|\n)/m.test(value)) score += 2;
  if (/~~[^~\n]+~~/.test(value)) score += 1;
  if (/\$[^$\n]+\$/.test(value)) score += 1;
  return score;
}

export function looksLikeMarkdown(value: string): boolean {
  const score = markdownSignalScore(value);
  const hasHeading = /(^|\n)\s{0,3}#{1,6}\s+\S/m.test(value);
  const hasSetextHeading = /(^|\n)[^\n]+\n(?:=+|-{3,})\s*($|\n)/m.test(value);
  const hasList = /(^|\n)\s{0,3}(?:[-*+]\s+|\d+[.)]\s+)/m.test(value);
  const hasRule = /(^|\n)\s*[-*_]{3,}\s*($|\n)/m.test(value);

  if (score >= 6) {
    return true;
  }
  // Long markdown posts can be mostly headings/rules with little inline syntax.
  if (value.length > 1800 && score >= 4 && (hasHeading || hasSetextHeading || hasList || hasRule)) {
    return true;
  }
  // Short technical content often only has inline code or links.
  return score >= 3 && value.length <= 2600;
}

export function safeHttpBaseUrl(input: string | null | undefined): string | null {
  if (!input?.trim()) {
    return null;
  }
  try {
    const parsed = new URL(input);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

export function hasArticleHtml(value: string): boolean {
  return /<(article|main|section|p|blockquote|ul|ol|h[1-6]|pre|table)\b/i.test(value);
}

export function htmlLooksLikeWrappedMarkdown(value: string): boolean {
  // If markdown has already been rendered into structural HTML (headings/lists/code/tables/hr),
  // keep HTML mode. Otherwise, wrapper-only tags may still contain raw markdown text.
  return !/<(h[1-6]|ul|ol|li|blockquote|pre|table|thead|tbody|tr|th|td|hr|code)\b/i.test(value);
}

export function looksLikeSummaryEcho(content: string, summary: string): boolean {
  if (!content || !summary) {
    return false;
  }

  if (content === summary) {
    return true;
  }

  const lengthDelta = Math.abs(content.length - summary.length);
  if (lengthDelta > 48) {
    return false;
  }

  return content.includes(summary) || summary.includes(content);
}
