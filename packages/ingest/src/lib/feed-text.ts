import { decodeHtmlEntities } from "./html-entities";
import {
  elementInner,
  firstImageSrc,
  htmlLooksLikeWrappedMarkdown,
  looksLikeHtml,
  looksLikeMarkdown,
  metaContent,
  removeScriptsAndStyles,
  stripTagMarkup,
} from "./text-scan";
import { compileArticleHtml } from "../document";
import { ARTICLE_HTML_SANITIZER_VERSION } from "@kyomi/reader/sanitization";
import type { ParsedFeedItem } from "../services/feed/types";

/**
 * `candidate` resolved against `baseUrl`, when the result is an http(s) URL without a login. A feed
 * is untrusted: `javascript:`, `data:` and `file:` URLs, and one that carries a password, must not
 * reach a stored link, image or icon that clients open or load.
 */
function absoluteHttpUrl(candidate: string | null, baseUrl: string): string | null {
  if (!candidate) {
    return null;
  }
  try {
    const url = new URL(candidate, baseUrl);
    const isHttp = url.protocol === "http:" || url.protocol === "https:";
    return isHttp && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

function stripTags(html: string): string {
  return decodeHtmlEntities(
    stripTagMarkup(removeScriptsAndStyles(html))
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function sanitizeStoredContent(value: string | null, baseUrl: string | null): string | null {
  if (!value) {
    return null;
  }
  const sanitized = looksLikeHtml(value)
    ? compileArticleHtml(value, { baseUrl }).html
    : removeScriptsAndStyles(value)
        .replace(/\son\w+="[^"]*"/gi, "")
        .replace(/\son\w+='[^']*'/gi, "")
        .trim();
  return sanitized || null;
}

/**
 * Compiles a feed item's body at ingest. `baseUrl` is the item link, so relative URLs and in-page
 * anchors resolve against the article rather than the feed.
 */
function buildStoredFeedContent(
  value: string | null,
  options?: { baseUrl?: string | null },
): StoredFeedContent {
  // Documents are compiled after parsing, in `attachItemDocuments`, because the compiler is async.
  return {
    ...buildStoredFeedBody(value, options),
    contentDocument: null,
    contentDocumentVersion: null,
    contentCompilerVersion: null,
  };
}

type StoredFeedContent = Pick<
  ParsedFeedItem,
  | "content"
  | "contentHtml"
  | "contentRaw"
  | "contentSanitizerVersion"
  | "contentText"
  | "contentMarkdown"
  | "contentStatus"
  | "contentSource"
  | "extractionErrorCode"
  | "extractionErrorMessage"
  | "contentDocument"
  | "contentDocumentVersion"
  | "contentCompilerVersion"
>;

function buildStoredFeedBody(
  value: string | null,
  options?: { baseUrl?: string | null },
): Omit<
  StoredFeedContent,
  "contentDocument" | "contentDocumentVersion" | "contentCompilerVersion"
> {
  const sanitized = sanitizeStoredContent(value, options?.baseUrl ?? null);
  const contentRaw = value?.trim() ? value : null;
  if (!sanitized) {
    return {
      content: null,
      contentHtml: null,
      contentRaw,
      contentSanitizerVersion: null,
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
        contentRaw,
        contentSanitizerVersion: null,
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
      contentRaw,
      contentSanitizerVersion: ARTICLE_HTML_SANITIZER_VERSION,
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
      contentRaw,
      contentSanitizerVersion: null,
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
    contentRaw,
    contentSanitizerVersion: null,
    contentText: sanitized,
    contentMarkdown: null,
    contentStatus: "partial",
    contentSource: "text_fallback",
    extractionErrorCode: null,
    extractionErrorMessage: null,
  };
}

function extractImageUrl(html: string | null, baseUrl: string): string | null {
  if (!html) {
    return null;
  }
  const trimmed = (value: string | null) => value?.trim() || null;
  return absoluteHttpUrl(
    trimmed(metaContent(html, "property", "og:image")) ??
      trimmed(metaContent(html, "name", "twitter:image")) ??
      trimmed(firstImageSrc(html)),
    baseUrl,
  );
}

function extractReadableTextFromHtml(html: string): string | null {
  const articleSection =
    elementInner(html, "article")?.trim() ||
    elementInner(html, "main")?.trim() ||
    elementInner(html, "body")?.trim() ||
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
  absoluteHttpUrl,
  stripTags,
  sanitizeStoredContent,
  buildStoredFeedContent,
  summarizeText,
  extractImageUrl,
  extractReadableTextFromHtml,
};
