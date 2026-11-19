import type {
  ArticleExtractionCandidate,
  ArticleReaderContentDto,
  ArticleReaderFallbackReason,
  ExtractedContentStatus,
} from "./types";
import { buildStoredReaderContent, fallbackNotice, type ReaderArticleInput } from "./normalize";
import { processArticleHtml } from "./sanitize";
import { safeHttpBaseUrl } from "./signals";

function inferFallbackReason(errorCode: string | null): ArticleReaderFallbackReason {
  if (errorCode === "TIMEOUT") {
    return "timeout";
  }
  return "extraction_failed";
}
/**
 * Builds extracted-mode reader content from persisted extracted columns.
 * Sanitization happens here again as a defense-in-depth step before returning HTML to clients.
 */
export function buildExtractedReaderViewFromDb(input: {
  articleType: "feed" | "clip";
  title: string;
  summary: string | null;
  contentBaseUrl: string | null;
  extractedContentHtml: string | null;
  extractedContentText: string | null;
  extractedContentStatus: ExtractedContentStatus;
  extractedContentSanitizerVersion?: string | null;
}): ArticleReaderContentDto | null {
  if (input.extractedContentStatus !== "ready") {
    return null;
  }
  const rawHtml = input.extractedContentHtml?.trim();
  if (!rawHtml) {
    return null;
  }
  // Pass the raw HTML and its stored sanitizer version through untouched;
  // buildReadabilityReaderContent performs the single sanitize/normalize/text-extraction
  // pass and skips re-sanitizing only when the version is already current.
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
      contentHtml: rawHtml,
      contentText: input.extractedContentText?.trim() || null,
      siteName: null,
      language: null,
      publishedTime: null,
    },
    input.extractedContentSanitizerVersion ?? null,
  );
}

export function buildReadabilityReaderContent(
  input: ReaderArticleInput,
  extracted: ArticleExtractionCandidate,
  sanitizerVersion: string | null = null,
): ArticleReaderContentDto {
  if (extracted.contentHtml?.trim()) {
    const processed = processArticleHtml(extracted.contentHtml, {
      baseUrl: safeHttpBaseUrl(input.contentBaseUrl),
      title: extracted.title ?? input.title,
      byline: extracted.byline,
      excerpt: extracted.excerpt ?? input.summary,
      sanitizerVersion,
    });
    return {
      contentStatus: "ready",
      contentSource: "extracted_html",
      bodyKind: "html",
      contentBaseUrl: safeHttpBaseUrl(input.contentBaseUrl),
      title: extracted.title ?? input.title,
      byline: extracted.byline,
      excerpt: extracted.excerpt ?? input.summary,
      contentHtml: processed.html,
      contentMarkdown: null,
      contentText: extracted.contentText?.trim() || processed.text || null,
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
