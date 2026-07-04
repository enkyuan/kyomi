import { isSafeEnrichmentUrl } from "../../lib/safe-url";
import {
  extractImageUrl,
  extractReadableTextFromHtml,
  sanitizeStoredContent,
} from "../../lib/feed-text";
import { fetchFeedDocument } from "./fetch";
import type { ParsedFeedItem } from "./types";

export async function fetchArticleEnrichment(url: string): Promise<{
  content: string | null;
  contentHtml: string | null;
  contentText: string | null;
  contentStatus: ParsedFeedItem["contentStatus"];
  contentSource: ParsedFeedItem["contentSource"];
  extractionErrorCode: string | null;
  extractionErrorMessage: string | null;
  imageUrl: string | null;
}> {
  if (!isSafeEnrichmentUrl(url)) {
    return {
      content: null,
      contentHtml: null,
      contentText: null,
      contentStatus: "failed",
      contentSource: "link_only",
      extractionErrorCode: "BLOCKED_URL",
      extractionErrorMessage: "Invalid or unsafe URL provided.",
      imageUrl: null,
    };
  }
  const fetched = await fetchFeedDocument(url, null, null, { accept: "html" });
  if (!fetched.ok) {
    return {
      content: null,
      contentHtml: null,
      contentText: null,
      contentStatus: "failed",
      contentSource: "link_only",
      extractionErrorCode: "FETCH_FAILED",
      extractionErrorMessage: fetched.error,
      imageUrl: null,
    };
  }
  if (fetched.notModified) {
    return {
      content: null,
      contentHtml: null,
      contentText: null,
      contentStatus: "failed",
      contentSource: "link_only",
      extractionErrorCode: "FETCH_NOT_MODIFIED",
      extractionErrorMessage: "Unexpected 304 Not Modified for enrichment",
      imageUrl: null,
    };
  }

  const contentText = sanitizeStoredContent(extractReadableTextFromHtml(fetched.body));

  return {
    content: contentText,
    contentHtml: null,
    contentText,
    contentStatus: contentText ? "partial" : "failed",
    contentSource: contentText ? "text_fallback" : "link_only",
    extractionErrorCode: null,
    extractionErrorMessage: null,
    imageUrl: extractImageUrl(fetched.body, fetched.finalUrl),
  };
}
