import type {
  ArticleExtractionCandidate,
  ArticleReaderContentDto,
  ArticleReaderFallbackReason,
  ArticleReaderStatus,
  ArticleStoredContentDto,
  ExtractedContentStatus,
} from "./articles.content.types";
import { htmlToText, sanitizeArticleHtml } from "./articles.sanitize-content";

type ReaderArticleInput = {
  articleType: "feed" | "clip";
  title: string;
  summary: string | null;
  contentBaseUrl: string | null;
  legacyContent: string | null;
  contentHtml: string | null;
  contentText: string | null;
  contentMarkdown: string | null;
  contentStatus: ArticleStoredContentDto["contentStatus"] | null;
  contentSource: ArticleStoredContentDto["contentSource"] | null;
  extractionErrorCode: string | null;
  extractionErrorMessage: string | null;
};

function normalizeText(value: string | null | undefined): string {
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

function countWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function countSentences(value: string): number {
  return (value.match(/[.!?](?=\s|$)/g) ?? []).length;
}

function looksLikeHtml(value: string): boolean {
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

function looksLikeMarkdown(value: string): boolean {
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

function safeHttpBaseUrl(input: string | null | undefined): string | null {
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

function hasArticleHtml(value: string): boolean {
  return /<(article|main|section|p|blockquote|ul|ol|h[1-6]|pre|table)\b/i.test(value);
}

function htmlLooksLikeWrappedMarkdown(value: string): boolean {
  // If markdown has already been rendered into structural HTML (headings/lists/code/tables/hr),
  // keep HTML mode. Otherwise, wrapper-only tags may still contain raw markdown text.
  return !/<(h[1-6]|ul|ol|li|blockquote|pre|table|thead|tbody|tr|th|td|hr|code)\b/i.test(value);
}

function looksLikeSummaryEcho(content: string, summary: string): boolean {
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

function contentFromLegacy(input: ReaderArticleInput) {
  const legacy = input.legacyContent?.trim();
  if (!legacy) {
    return null;
  }

  const baseUrl = safeHttpBaseUrl(input.contentBaseUrl);
  if (looksLikeHtml(legacy)) {
    const html = sanitizeArticleHtml(legacy, { baseUrl });
    if (!html) {
      const text = htmlToText(legacy).trim();
      if (!text) {
        return null;
      }
      const bodyKind: "markdown" | "text" = looksLikeMarkdown(text) ? "markdown" : "text";
      return {
        bodyKind,
        contentHtml: null,
        contentMarkdown: bodyKind === "markdown" ? text : null,
        contentText: text,
        contentSource:
          bodyKind === "markdown" ? ("feed_markdown" as const) : ("text_fallback" as const),
        contentStatus: "partial" as const,
      };
    }
    const htmlText = htmlToText(html).trim();
    if (htmlText && looksLikeMarkdown(htmlText) && htmlLooksLikeWrappedMarkdown(html)) {
      return {
        bodyKind: "markdown" as const,
        contentHtml: null,
        contentMarkdown: htmlText,
        contentText: htmlText,
        contentSource: "feed_markdown" as const,
        contentStatus: "partial" as const,
      };
    }
    return {
      bodyKind: "html" as const,
      contentHtml: html,
      contentMarkdown: null,
      contentText: htmlToText(html) || null,
      contentSource: "feed_html" as const,
      contentStatus: "partial" as const,
    };
  }

  if (looksLikeMarkdown(legacy)) {
    return {
      bodyKind: "markdown" as const,
      contentHtml: null,
      contentMarkdown: legacy,
      contentText: legacy,
      contentSource: "feed_markdown" as const,
      contentStatus: "partial" as const,
    };
  }

  return {
    bodyKind: "text" as const,
    contentHtml: null,
    contentMarkdown: null,
    contentText: legacy,
    contentSource: "text_fallback" as const,
    contentStatus: "partial" as const,
  };
}

function buildStoredBody(input: ReaderArticleInput) {
  const baseUrl = safeHttpBaseUrl(input.contentBaseUrl);
  if (input.contentHtml?.trim()) {
    const html = sanitizeArticleHtml(input.contentHtml, { baseUrl });
    if (!html) {
      const textCandidate = input.contentText?.trim() ?? htmlToText(input.contentHtml).trim();
      if (textCandidate) {
        const bodyKind: "markdown" | "text" = looksLikeMarkdown(textCandidate)
          ? "markdown"
          : "text";
        return {
          bodyKind,
          contentHtml: null,
          contentMarkdown: bodyKind === "markdown" ? textCandidate : null,
          contentText: textCandidate,
          contentSource:
            input.contentSource ?? (bodyKind === "markdown" ? "feed_markdown" : "text_fallback"),
          contentStatus: input.contentStatus ?? "partial",
        };
      }
      return null;
    }
    const htmlText = input.contentText?.trim() || htmlToText(html).trim();
    if (htmlText && looksLikeMarkdown(htmlText) && htmlLooksLikeWrappedMarkdown(html)) {
      return {
        bodyKind: "markdown" as const,
        contentHtml: null,
        contentMarkdown: htmlText,
        contentText: htmlText,
        contentSource: input.contentSource ?? "feed_markdown",
        contentStatus: input.contentStatus ?? "partial",
      };
    }
    return {
      bodyKind: "html" as const,
      contentHtml: html,
      contentMarkdown: null,
      contentText: input.contentText?.trim() || htmlToText(html) || null,
      contentSource: input.contentSource ?? "feed_html",
      contentStatus: input.contentStatus ?? "ready",
    };
  }

  if (input.contentMarkdown?.trim()) {
    return {
      bodyKind: "markdown" as const,
      contentHtml: null,
      contentMarkdown: input.contentMarkdown.trim(),
      contentText: input.contentText?.trim() || input.contentMarkdown.trim(),
      contentSource: input.contentSource ?? "feed_markdown",
      contentStatus: input.contentStatus ?? "ready",
    };
  }

  if (input.contentText?.trim()) {
    const text = input.contentText.trim();
    const bodyKind: "markdown" | "text" = looksLikeMarkdown(text) ? "markdown" : "text";
    return {
      bodyKind,
      contentHtml: null,
      contentMarkdown: bodyKind === "markdown" ? text : null,
      contentText: text,
      contentSource:
        input.contentSource ?? (bodyKind === "markdown" ? "feed_markdown" : "text_fallback"),
      contentStatus: input.contentStatus ?? "partial",
    };
  }

  return contentFromLegacy(input);
}

export function buildStoredContentRecord(input: ReaderArticleInput): ArticleStoredContentDto {
  const body = buildStoredBody(input);
  if (body) {
    return {
      contentHtml: body.contentHtml,
      contentText: body.contentText,
      contentMarkdown: body.contentMarkdown,
      contentStatus: body.contentStatus,
      contentSource: body.contentSource,
      extractionErrorCode: input.extractionErrorCode,
      extractionErrorMessage: input.extractionErrorMessage,
    };
  }

  if (input.summary?.trim()) {
    return {
      contentHtml: null,
      contentText: null,
      contentMarkdown: null,
      contentStatus: "partial",
      contentSource: "feed_summary",
      extractionErrorCode: input.extractionErrorCode,
      extractionErrorMessage: input.extractionErrorMessage,
    };
  }

  return {
    contentHtml: null,
    contentText: null,
    contentMarkdown: null,
    contentStatus: input.contentStatus ?? "pending",
    contentSource: input.contentSource ?? "link_only",
    extractionErrorCode: input.extractionErrorCode,
    extractionErrorMessage: input.extractionErrorMessage,
  };
}

function shouldExtractStoredContent(input: ReaderArticleInput): boolean {
  const body = buildStoredBody(input);
  const text =
    body?.contentText?.trim() ??
    body?.contentMarkdown?.trim() ??
    htmlToText(body?.contentHtml ?? "").trim();

  if (!text) {
    return input.articleType === "feed";
  }

  if (/^comments?$/i.test(text) || /^comments?\s+on\s+/i.test(text)) {
    return true;
  }

  if (input.articleType === "clip") {
    return false;
  }

  const normalizedContent = normalizeText(text);
  const normalizedSummary = normalizeText(input.summary);
  const words = countWords(normalizedContent);
  const sentences = countSentences(text);
  const summaryEcho = looksLikeSummaryEcho(normalizedContent, normalizedSummary);
  const hasHtml = Boolean(body?.contentHtml && hasArticleHtml(body.contentHtml));

  if (summaryEcho && words < 180) {
    return true;
  }

  if (words < 40) {
    return true;
  }

  if (!hasHtml && sentences < 2 && words < 90) {
    return true;
  }

  return false;
}

function fallbackNotice(hasContent: boolean, hasSummary: boolean): string {
  if (hasContent) {
    return "Full preview unavailable right now. Showing the best saved version instead.";
  }
  if (hasSummary) {
    return "Full preview unavailable right now. Showing feed summary instead.";
  }
  return "This source could not be previewed in the reader.";
}

function inferFallbackReason(errorCode: string | null): ArticleReaderFallbackReason {
  if (errorCode === "TIMEOUT") {
    return "timeout";
  }
  return "extraction_failed";
}

function toReaderStatus(
  status: ArticleStoredContentDto["contentStatus"] | null,
): ArticleReaderStatus {
  if (status === "ready" || status === "partial" || status === "failed") {
    return status;
  }
  return "partial";
}

export function buildStoredReaderContent(input: ReaderArticleInput): ArticleReaderContentDto {
  const storedBody = buildStoredBody(input);
  const shouldExtract = shouldExtractStoredContent(input);

  if (storedBody) {
    const base = {
      contentStatus: toReaderStatus(storedBody.contentStatus),
      contentSource: storedBody.contentSource,
      contentBaseUrl: safeHttpBaseUrl(input.contentBaseUrl),
      title: input.title,
      byline: null,
      excerpt: input.summary,
      siteName: null,
      language: null,
      publishedTime: null,
      notice:
        input.contentStatus === "failed" ? fallbackNotice(true, Boolean(input.summary)) : null,
      extractionErrorCode: input.extractionErrorCode,
      extractionErrorMessage: input.extractionErrorMessage,
      shouldExtract,
      fallbackSummary: null,
      fallbackReason: null,
    };

    if (storedBody.bodyKind === "html" && storedBody.contentHtml) {
      return {
        ...base,
        bodyKind: "html",
        contentHtml: storedBody.contentHtml,
        contentMarkdown: null,
        contentText: storedBody.contentText,
      };
    }
    if (storedBody.bodyKind === "markdown" && storedBody.contentMarkdown) {
      return {
        ...base,
        bodyKind: "markdown",
        contentHtml: null,
        contentMarkdown: storedBody.contentMarkdown,
        contentText: storedBody.contentText,
      };
    }
    if (storedBody.contentText) {
      return {
        ...base,
        bodyKind: "text",
        contentHtml: null,
        contentMarkdown: null,
        contentText: storedBody.contentText,
      };
    }
  }

  if (input.summary?.trim()) {
    return {
      contentStatus: "partial",
      contentSource: "feed_summary",
      bodyKind: "fallback",
      contentBaseUrl: safeHttpBaseUrl(input.contentBaseUrl),
      title: input.title,
      byline: null,
      excerpt: input.summary,
      contentHtml: null,
      contentMarkdown: null,
      contentText: null,
      fallbackSummary: input.summary,
      fallbackReason: "missing_content",
      siteName: null,
      language: null,
      publishedTime: null,
      notice: input.contentStatus === "failed" ? fallbackNotice(false, true) : null,
      extractionErrorCode: input.extractionErrorCode,
      extractionErrorMessage: input.extractionErrorMessage,
      shouldExtract: input.articleType === "feed",
    };
  }

  return {
    contentStatus: input.contentStatus === "partial" ? "partial" : "failed",
    contentSource: input.contentSource ?? "link_only",
    bodyKind: "fallback",
    contentBaseUrl: safeHttpBaseUrl(input.contentBaseUrl),
    title: input.title,
    byline: null,
    excerpt: null,
    contentHtml: null,
    contentMarkdown: null,
    contentText: null,
    fallbackSummary: null,
    fallbackReason: "missing_content",
    siteName: null,
    language: null,
    publishedTime: null,
    notice: fallbackNotice(false, false),
    extractionErrorCode: input.extractionErrorCode,
    extractionErrorMessage: input.extractionErrorMessage,
    shouldExtract: input.articleType === "feed",
  };
}

/**
 * Builds the extracted-mode reader view from persisted extracted columns (already sanitized on write).
 */
export function buildExtractedReaderViewFromDb(input: {
  articleType: "feed" | "clip";
  title: string;
  summary: string | null;
  contentBaseUrl: string | null;
  extractedContentHtml: string | null;
  extractedContentText: string | null;
  extractedContentStatus: ExtractedContentStatus;
}): ArticleReaderContentDto | null {
  if (input.extractedContentStatus !== "ready") {
    return null;
  }
  const rawHtml = input.extractedContentHtml?.trim();
  if (!rawHtml) {
    return null;
  }
  const sanitized = sanitizeArticleHtml(rawHtml, {
    baseUrl: safeHttpBaseUrl(input.contentBaseUrl),
  });
  const text = input.extractedContentText?.trim() || (sanitized ? htmlToText(sanitized) : null);
  return buildReadabilityReaderContent(
    {
      articleType: input.articleType,
      title: input.title,
      summary: input.summary,
      contentBaseUrl: input.contentBaseUrl,
      legacyContent: null,
      contentHtml: null,
      contentText: null,
      contentMarkdown: null,
      contentStatus: "ready",
      contentSource: "feed_html",
      extractionErrorCode: null,
      extractionErrorMessage: null,
    },
    {
      title: null,
      byline: null,
      excerpt: input.summary,
      contentHtml: sanitized || null,
      contentText: text,
      siteName: null,
      language: null,
      publishedTime: null,
    },
  );
}

export function buildReadabilityReaderContent(
  input: ReaderArticleInput,
  extracted: ArticleExtractionCandidate,
): ArticleReaderContentDto {
  if (extracted.contentHtml?.trim()) {
    return {
      contentStatus: "ready",
      contentSource: "extracted_html",
      bodyKind: "html",
      contentBaseUrl: safeHttpBaseUrl(input.contentBaseUrl),
      title: extracted.title ?? input.title,
      byline: extracted.byline,
      excerpt: extracted.excerpt ?? input.summary,
      contentHtml: extracted.contentHtml,
      contentMarkdown: null,
      contentText: extracted.contentText,
      fallbackSummary: null,
      fallbackReason: null,
      siteName: extracted.siteName,
      language: extracted.language,
      publishedTime: extracted.publishedTime,
      notice: null,
      extractionErrorCode: null,
      extractionErrorMessage: null,
      shouldExtract: false,
    };
  }

  if (extracted.contentText?.trim()) {
    return {
      contentStatus: "ready",
      contentSource: "extracted_html",
      bodyKind: "text",
      contentBaseUrl: safeHttpBaseUrl(input.contentBaseUrl),
      title: extracted.title ?? input.title,
      byline: extracted.byline,
      excerpt: extracted.excerpt ?? input.summary,
      contentHtml: null,
      contentMarkdown: null,
      contentText: extracted.contentText,
      fallbackSummary: null,
      fallbackReason: null,
      siteName: extracted.siteName,
      language: extracted.language,
      publishedTime: extracted.publishedTime,
      notice: null,
      extractionErrorCode: null,
      extractionErrorMessage: null,
      shouldExtract: false,
    };
  }

  return {
    contentStatus: "failed",
    contentSource: "link_only",
    bodyKind: "fallback",
    contentBaseUrl: safeHttpBaseUrl(input.contentBaseUrl),
    title: extracted.title ?? input.title,
    byline: extracted.byline,
    excerpt: extracted.excerpt ?? input.summary,
    contentHtml: null,
    contentMarkdown: null,
    contentText: null,
    fallbackSummary: input.summary,
    fallbackReason: "missing_content",
    siteName: extracted.siteName,
    language: extracted.language,
    publishedTime: extracted.publishedTime,
    notice: fallbackNotice(false, Boolean(input.summary)),
    extractionErrorCode: null,
    extractionErrorMessage: null,
    shouldExtract: false,
  };
}

export function buildFallbackReaderContent(
  input: ReaderArticleInput,
  error: { code: string; message: string },
): ArticleReaderContentDto {
  const base = buildStoredReaderContent({
    ...input,
    contentStatus: "failed",
    extractionErrorCode: error.code,
    extractionErrorMessage: error.message,
  });
  const hasContent =
    Boolean(base.contentHtml?.trim()) ||
    Boolean(base.contentMarkdown?.trim()) ||
    Boolean(base.contentText?.trim());

  if (base.bodyKind === "fallback") {
    return {
      ...base,
      contentStatus: hasContent || Boolean(base.fallbackSummary) ? "partial" : "failed",
      notice: fallbackNotice(hasContent, Boolean(base.fallbackSummary)),
      extractionErrorCode: error.code,
      extractionErrorMessage: error.message,
      fallbackReason: base.fallbackReason ?? inferFallbackReason(error.code),
      shouldExtract: false,
    };
  }

  return {
    ...base,
    contentStatus: "partial",
    notice: fallbackNotice(true, Boolean(base.fallbackSummary)),
    extractionErrorCode: error.code,
    extractionErrorMessage: error.message,
    fallbackReason: null,
    shouldExtract: false,
  };
}
