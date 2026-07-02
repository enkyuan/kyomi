import type { drizzle } from "drizzle-orm/node-postgres";
import type * as schema from "@kyomi/db";

export type FeedRefreshResult = {
  ok: boolean;
  itemCount: number;
  insertedCount?: number;
  updatedCount?: number;
  notModified?: boolean;
  error?: string;
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
