import type { drizzle } from "drizzle-orm/node-postgres";
import type * as schema from "@kyomi/db";
import type { InferredCategoryLabel } from "./classifier";

export type FeedRefreshCategoryStats = {
  feedClassifierLabels: number;
  itemClassifierLabels: number;
  itemClassifierAbstentions: number;
  suppressedFeedClassifierFallback: boolean;
  embeddingClassifier?: {
    configured: boolean;
    feedClassifierLabels: number;
    feedClassifierAbstentions: number;
    feedClassifierFailures: number;
    itemClassifierLabels: number;
    itemClassifierAbstentions: number;
    itemClassifierFailures: number;
  };
  sourceTagAssignments?: number;
};

export type HtmlFeedFailureClass =
  | "html_not_feed"
  | "access_denied_html"
  | "captcha_html"
  | "login_html"
  | "stale_endpoint_html";

export type FeedRefreshResult = {
  ok: boolean;
  itemCount: number;
  insertedCount?: number;
  updatedCount?: number;
  articleExtractionCandidateIds?: string[];
  notModified?: boolean;
  error?: string;
  failureClass?: HtmlFeedFailureClass;
  categoryStats?: FeedRefreshCategoryStats;
  // True when the failure cannot be resolved by retrying (e.g. HTTP 4xx other than 408/429).
  permanent?: boolean;
};

export type FeedIngestDatabase = ReturnType<typeof drizzle<typeof schema>>;

export type FeedMetadata = {
  title: string;
  description: string;
  link: string | null;
  iconUrl: string | null;
  canonicalUrl: string;
  categoryLabels: string[];
};

export type ParsedFeedItem = {
  id: string;
  stableIdentity: string;
  canonicalUrl: string;
  title: string;
  link: string;
  summary: string | null;
  content: string | null;
  contentHtml: string | null;
  contentText: string | null;
  contentMarkdown: string | null;
  contentStatus: "ready" | "partial" | "failed" | "pending";
  contentSource:
    | "feed_html"
    | "feed_markdown"
    | "feed_summary"
    | "extracted_html"
    | "text_fallback"
    | "link_only";
  extractionErrorCode: string | null;
  extractionErrorMessage: string | null;
  imageUrl: string | null;
  publishedAt: Date;
  categoryLabels: string[];
  inferredCategoryLabels?: InferredCategoryLabel[];
};

export type ParsedFeedDocument = {
  metadata: FeedMetadata;
  items: ParsedFeedItem[];
};

export type FetchFeedDocumentResult =
  | {
      ok: true;
      finalUrl: string;
      body: string;
      contentType: string;
      etag: string | null;
      lastModified: string | null;
      notModified: false;
    }
  | {
      ok: true;
      notModified: true;
      etag: string | null;
      lastModified: string | null;
    }
  | { ok: false; error: string; httpStatus?: number };

export type SearchSyncConfig = {
  url: string;
  masterKey?: string;
  indexUid?: string;
};

export type HostRateLimiter = {
  run<T>(url: string, task: () => Promise<T>): Promise<T>;
};
