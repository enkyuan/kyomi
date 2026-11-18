import {
  htmlLooksLikeWrappedMarkdown,
  looksLikeHtml,
  looksLikeMarkdown as looksLikeMarkdownText,
  removeScriptsAndStyles,
  stripTagMarkup,
} from "@kyomi/ingest/lib/text-scan";

/** Text heuristics shared by the reader body builders: what a string looks like, not what it is. */

export { htmlLooksLikeWrappedMarkdown, looksLikeHtml };

export function normalizeText(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  return stripTagMarkup(removeScriptsAndStyles(value))
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

export function looksLikeMarkdown(value: string): boolean {
  return looksLikeMarkdownText(value, { strikeAndMath: true });
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
