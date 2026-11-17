import type {
  ArticleReaderContentDto,
  ArticleReaderStatus,
  ArticleStoredContentDto,
} from "./types";
import { normalizeMarkdownFeedArtifacts } from "./markdown";
import {
  ARTICLE_HTML_SANITIZER_VERSION,
  htmlToText,
  processIngestedArticleHtml,
  sanitizeArticleHtml,
} from "./sanitize";
import {
  countSentences,
  countWords,
  hasArticleHtml,
  htmlLooksLikeWrappedMarkdown,
  looksLikeHtml,
  looksLikeMarkdown,
  looksLikeSummaryEcho,
  normalizeText,
  safeHttpBaseUrl,
} from "./signals";

type HtmlSanitizer = (
  html: string,
  options: {
    baseUrl: string | null;
    title: string;
    byline: null;
    excerpt: string | null;
    trustCompilerHints: boolean;
  },
) => string;

/**
 * Write paths compile untrusted HTML once; read paths re-apply only the policy, because the
 * compiler's first pass would strip the `data-kyomi-*` hints it wrote on ingest.
 */
const READ_SANITIZER: HtmlSanitizer = sanitizeArticleHtml;
const INGEST_SANITIZER: HtmlSanitizer = (html, options) =>
  processIngestedArticleHtml(html, options).html;

export type ReaderArticleInput = {
  articleType: "feed" | "clip";
  /** Sanitizer version stored with `contentHtml`; only a current version marks it as compiled. */
  contentSanitizerVersion?: string | null;
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

type StoredBody = Pick<
  ArticleStoredContentDto,
  "contentHtml" | "contentText" | "contentMarkdown" | "contentStatus" | "contentSource"
> & { bodyKind: "html" | "markdown" | "text" };

/** What an input's own columns say about a body, applied where the body kind leaves a choice. */
type BodyDefaults = {
  contentSource: ArticleStoredContentDto["contentSource"] | null;
  contentStatus: ArticleStoredContentDto["contentStatus"] | null;
  /** Status for an HTML body: stored columns are `ready`, legacy `content` is only `partial`. */
  htmlStatus: ArticleStoredContentDto["contentStatus"];
};

const STORED_DEFAULTS = (input: ReaderArticleInput): BodyDefaults => ({
  contentSource: input.contentSource,
  contentStatus: input.contentStatus,
  htmlStatus: "ready",
});

const LEGACY_DEFAULTS: BodyDefaults = {
  contentSource: null,
  contentStatus: null,
  htmlStatus: "partial",
};

function markdownBody(markdown: string, text: string, defaults: BodyDefaults): StoredBody {
  return {
    bodyKind: "markdown",
    contentHtml: null,
    contentMarkdown: markdown,
    contentText: text,
    contentSource: defaults.contentSource ?? "feed_markdown",
    contentStatus: defaults.contentStatus ?? "partial",
  };
}

/** A plain-text body, promoted to markdown when it reads as markdown. */
function textBody(raw: string, defaults: BodyDefaults): StoredBody {
  if (looksLikeMarkdown(raw)) {
    const markdown = normalizeMarkdownFeedArtifacts(raw);
    return markdownBody(markdown, markdown, defaults);
  }
  return {
    bodyKind: "text",
    contentHtml: null,
    contentMarkdown: null,
    contentText: raw,
    contentSource: defaults.contentSource ?? "text_fallback",
    contentStatus: defaults.contentStatus ?? "partial",
  };
}

/**
 * A body from sanitized HTML. HTML that is only a wrapper around raw markdown text becomes a
 * markdown body; anything with structural markup stays HTML.
 */
function htmlBody(
  html: string,
  preferredText: string | null | undefined,
  defaults: BodyDefaults,
): StoredBody {
  const text = preferredText?.trim() || htmlToText(html).trim();
  const wrappedMarkdown = normalizeMarkdownFeedArtifacts(text);
  if (wrappedMarkdown && looksLikeMarkdown(wrappedMarkdown) && htmlLooksLikeWrappedMarkdown(html)) {
    return markdownBody(wrappedMarkdown, wrappedMarkdown, defaults);
  }
  return {
    bodyKind: "html",
    contentHtml: html,
    contentMarkdown: null,
    contentText: preferredText?.trim() || htmlToText(html) || null,
    contentSource: defaults.contentSource ?? "feed_html",
    contentStatus: defaults.contentStatus ?? defaults.htmlStatus,
  };
}

function sanitizeInputHtml(
  input: ReaderArticleInput,
  html: string,
  sanitize: HtmlSanitizer,
  trustCompilerHints: boolean,
): string {
  return sanitize(html, {
    baseUrl: safeHttpBaseUrl(input.contentBaseUrl),
    title: input.title,
    byline: null,
    excerpt: input.summary,
    trustCompilerHints,
  });
}

function contentFromLegacy(input: ReaderArticleInput, sanitize: HtmlSanitizer): StoredBody | null {
  const legacy = input.legacyContent?.trim();
  if (!legacy) {
    return null;
  }
  if (!looksLikeHtml(legacy)) {
    return textBody(legacy, LEGACY_DEFAULTS);
  }

  // Legacy `content` has no stored version of its own (clips keep client input there).
  const html = sanitizeInputHtml(input, legacy, sanitize, false);
  if (html) {
    return htmlBody(html, null, LEGACY_DEFAULTS);
  }
  const text = htmlToText(legacy).trim();
  return text ? textBody(text, LEGACY_DEFAULTS) : null;
}

function buildStoredBody(
  input: ReaderArticleInput,
  sanitize: HtmlSanitizer = READ_SANITIZER,
): StoredBody | null {
  // Canonical body-kind inference lives on the server. Clients render this result as-is.
  const defaults = STORED_DEFAULTS(input);
  if (input.contentHtml?.trim()) {
    const trusted = input.contentSanitizerVersion === ARTICLE_HTML_SANITIZER_VERSION;
    const html = sanitizeInputHtml(input, input.contentHtml, sanitize, trusted);
    if (html) {
      return htmlBody(html, input.contentText, defaults);
    }
    const rawCandidate = input.contentText?.trim() ?? htmlToText(input.contentHtml).trim();
    return rawCandidate ? textBody(rawCandidate, defaults) : null;
  }

  if (input.contentMarkdown?.trim()) {
    const markdown = normalizeMarkdownFeedArtifacts(input.contentMarkdown.trim());
    return {
      ...markdownBody(markdown, input.contentText?.trim() || markdown, defaults),
      contentStatus: defaults.contentStatus ?? "ready",
    };
  }

  if (input.contentText?.trim()) {
    return textBody(input.contentText.trim(), defaults);
  }

  return contentFromLegacy(input, sanitize);
}

/** Write-time record for a clip: HTML is compiled, and its sanitizer version is stamped. */
export function buildStoredContentRecord(
  input: ReaderArticleInput,
): ArticleStoredContentDto & { contentSanitizerVersion: string | null } {
  const body = buildStoredBody(input, INGEST_SANITIZER);
  if (body) {
    return {
      contentSanitizerVersion: body.contentHtml ? ARTICLE_HTML_SANITIZER_VERSION : null,
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
      contentSanitizerVersion: null,
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
    contentSanitizerVersion: null,
    contentHtml: null,
    contentText: null,
    contentMarkdown: null,
    contentStatus: input.contentStatus ?? "pending",
    contentSource: input.contentSource ?? "link_only",
    extractionErrorCode: input.extractionErrorCode,
    extractionErrorMessage: input.extractionErrorMessage,
  };
}

/** Feed content too short, or too close to the feed summary, to be the whole article. */
function isThinContent(text: string, summary: string | null, hasHtml: boolean): boolean {
  const normalizedContent = normalizeText(text);
  const words = countWords(normalizedContent);
  const summaryEcho = looksLikeSummaryEcho(normalizedContent, normalizeText(summary));
  return (
    (summaryEcho && words < 180) ||
    words < 40 ||
    (!hasHtml && countSentences(text) < 2 && words < 90)
  );
}

function shouldExtractStoredContent(input: ReaderArticleInput, body: StoredBody | null): boolean {
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

  return isThinContent(
    text,
    input.summary,
    Boolean(body?.contentHtml && hasArticleHtml(body.contentHtml)),
  );
}

export function fallbackNotice(hasContent: boolean, hasSummary: boolean): string {
  if (hasContent) {
    return "Full preview unavailable right now. Showing the best saved version instead.";
  }
  if (hasSummary) {
    return "Full preview unavailable right now. Showing feed summary instead.";
  }
  return "This source could not be previewed in the reader.";
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
  // Invariant: this function is the only place that maps stored/original columns to reader bodyKind.
  const storedBody = buildStoredBody(input);
  const shouldExtract = shouldExtractStoredContent(input, storedBody);

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
