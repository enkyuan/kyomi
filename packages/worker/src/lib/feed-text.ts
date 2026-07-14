import { decodeHtmlEntities } from "./html-entities";
import { sanitizeArticleHtmlFragment } from "../sanitization";
import type { ParsedFeedItem } from "../services/feed/types";

function absoluteUrl(candidate: string | null, baseUrl: string): string | null {
  if (!candidate) {
    return null;
  }
  try {
    return new URL(candidate, baseUrl).href;
  } catch {
    return null;
  }
}

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function sanitizeStoredContent(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const sanitized = looksLikeHtml(value)
    ? sanitizeArticleHtmlFragment(value).trim()
    : value
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/\son\w+="[^"]*"/gi, "")
        .replace(/\son\w+='[^']*'/gi, "")
        .trim();
  return sanitized || null;
}

function looksLikeHtml(value: string | null): boolean {
  return Boolean(value && /<[a-z][\s\S]*>/i.test(value));
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
  return score;
}

function looksLikeMarkdown(value: string | null): boolean {
  if (!value) {
    return false;
  }
  const score = markdownSignalScore(value);
  const hasHeading = /(^|\n)\s{0,3}#{1,6}\s+\S/m.test(value);
  const hasSetextHeading = /(^|\n)[^\n]+\n(?:=+|-{3,})\s*($|\n)/m.test(value);
  const hasList = /(^|\n)\s{0,3}(?:[-*+]\s+|\d+[.)]\s+)/m.test(value);
  const hasRule = /(^|\n)\s*[-*_]{3,}\s*($|\n)/m.test(value);

  if (score >= 6) {
    return true;
  }
  if (value.length > 1800 && score >= 4 && (hasHeading || hasSetextHeading || hasList || hasRule)) {
    return true;
  }
  return score >= 3 && value.length <= 2600;
}

function htmlLooksLikeWrappedMarkdown(value: string): boolean {
  return !/<(h[1-6]|ul|ol|li|blockquote|pre|table|thead|tbody|tr|th|td|hr|code)\b/i.test(value);
}

function buildStoredFeedContent(
  value: string | null,
): Pick<
  ParsedFeedItem,
  | "content"
  | "contentHtml"
  | "contentText"
  | "contentMarkdown"
  | "contentStatus"
  | "contentSource"
  | "extractionErrorCode"
  | "extractionErrorMessage"
> {
  const sanitized = sanitizeStoredContent(value);
  if (!sanitized) {
    return {
      content: null,
      contentHtml: null,
      contentText: null,
      contentMarkdown: null,
      contentStatus: "pending",
      contentSource: "link_only",
      extractionErrorCode: null,
      extractionErrorMessage: null,
    };
  }

  if (looksLikeHtml(sanitized)) {
    const htmlText = stripTags(sanitized);
    if (looksLikeMarkdown(htmlText) && htmlLooksLikeWrappedMarkdown(sanitized)) {
      return {
        content: sanitized,
        contentHtml: null,
        contentText: htmlText,
        contentMarkdown: htmlText,
        contentStatus: "ready",
        contentSource: "feed_markdown",
        extractionErrorCode: null,
        extractionErrorMessage: null,
      };
    }
    return {
      content: sanitized,
      contentHtml: sanitized,
      contentText: stripTags(sanitized),
      contentMarkdown: null,
      contentStatus: "ready",
      contentSource: "feed_html",
      extractionErrorCode: null,
      extractionErrorMessage: null,
    };
  }

  if (looksLikeMarkdown(sanitized)) {
    return {
      content: sanitized,
      contentHtml: null,
      contentText: sanitized,
      contentMarkdown: sanitized,
      contentStatus: "ready",
      contentSource: "feed_markdown",
      extractionErrorCode: null,
      extractionErrorMessage: null,
    };
  }

  return {
    content: sanitized,
    contentHtml: null,
    contentText: sanitized,
    contentMarkdown: null,
    contentStatus: "partial",
    contentSource: "text_fallback",
    extractionErrorCode: null,
    extractionErrorMessage: null,
  };
}

function firstMatch(input: string, pattern: RegExp): string | null {
  const match = input.match(pattern);
  return match?.[1]?.trim() || null;
}

function extractImageUrl(html: string | null, baseUrl: string): string | null {
  if (!html) {
    return null;
  }
  return (
    absoluteUrl(
      firstMatch(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
        firstMatch(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ??
        firstMatch(html, /<img[^>]+src=["']([^"']+)["']/i),
      baseUrl,
    ) ?? null
  );
}

function extractReadableTextFromHtml(html: string): string | null {
  const articleSection =
    firstMatch(html, /<article[^>]*>([\s\S]*?)<\/article>/i) ??
    firstMatch(html, /<main[^>]*>([\s\S]*?)<\/main>/i) ??
    firstMatch(html, /<body[^>]*>([\s\S]*?)<\/body>/i) ??
    html;
  const text = stripTags(articleSection);
  return text || null;
}

function summarizeText(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const plain = stripTags(value);
  if (!plain) {
    return null;
  }
  return plain.length > 280 ? `${plain.slice(0, 277)}...` : plain;
}

export {
  stripTags,
  sanitizeStoredContent,
  buildStoredFeedContent,
  summarizeText,
  extractImageUrl,
  extractReadableTextFromHtml,
};
