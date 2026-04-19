/**
 * Zod schemas for API response validation on server functions.
 *
 * These provide a type-safe boundary between the API and the frontend.
 * Instead of blindly casting `as T` from `apiJson`, responses are validated
 * at runtime, catching API contract drift before it reaches the UI.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

export const contentStatusSchema = z.enum(["ready", "partial", "failed", "pending"]);

export const contentSourceSchema = z.enum([
  "feed_html",
  "feed_markdown",
  "feed_summary",
  "extracted_html",
  "text_fallback",
  "link_only",
]);

export const bodyKindSchema = z.enum(["html", "markdown", "text", "fallback"]);

export const articleTypeSchema = z.enum(["feed", "clip"]);

export const fallbackReasonSchema = z
  .enum(["extraction_failed", "timeout", "missing_content"])
  .nullable();

// ---------------------------------------------------------------------------
// Reader content
// ---------------------------------------------------------------------------

const readerContentCommonSchema = z.object({
  contentStatus: z.enum(["ready", "partial", "failed"]),
  contentSource: contentSourceSchema,
  bodyKind: bodyKindSchema,
  contentBaseUrl: z.string().nullable(),
  title: z.string().nullable(),
  byline: z.string().nullable(),
  excerpt: z.string().nullable(),
  siteName: z.string().nullable(),
  language: z.string().nullable(),
  publishedTime: z.string().nullable(),
  notice: z.string().nullable(),
  extractionErrorCode: z.string().nullable(),
  extractionErrorMessage: z.string().nullable(),
  shouldExtract: z.boolean(),
});

const readerHtmlSchema = readerContentCommonSchema.extend({
  bodyKind: z.literal("html"),
  contentHtml: z.string(),
  contentMarkdown: z.null(),
  contentText: z.string().nullable(),
  fallbackSummary: z.null(),
  fallbackReason: z.null(),
});

const readerMarkdownSchema = readerContentCommonSchema.extend({
  bodyKind: z.literal("markdown"),
  contentHtml: z.null(),
  contentMarkdown: z.string(),
  contentText: z.string().nullable(),
  fallbackSummary: z.null(),
  fallbackReason: z.null(),
});

const readerTextSchema = readerContentCommonSchema.extend({
  bodyKind: z.literal("text"),
  contentHtml: z.null(),
  contentMarkdown: z.null(),
  contentText: z.string(),
  fallbackSummary: z.null(),
  fallbackReason: z.null(),
});

const readerFallbackSchema = readerContentCommonSchema.extend({
  bodyKind: z.literal("fallback"),
  contentHtml: z.null(),
  contentMarkdown: z.null(),
  contentText: z.null(),
  fallbackSummary: z.string().nullable(),
  fallbackReason: z.enum(["extraction_failed", "timeout", "missing_content"]),
});

export const readerContentSchema = z.discriminatedUnion("bodyKind", [
  readerHtmlSchema,
  readerMarkdownSchema,
  readerTextSchema,
  readerFallbackSchema,
]);

// ---------------------------------------------------------------------------
// Article list items
// ---------------------------------------------------------------------------

export const articleListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  link: z.string(),
  summary: z.string().nullable(),
  publishedAt: z.string(),
  feedId: z.string(),
  feedTitle: z.string(),
  isRead: z.boolean(),
  isSaved: z.boolean(),
  articleType: articleTypeSchema,
});

export const cursorListResponseSchema = z.object({
  items: z.array(articleListItemSchema),
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
  total_count: z.number().nullable(),
});

// ---------------------------------------------------------------------------
// Article detail
// ---------------------------------------------------------------------------

export const extractedContentStatusSchema = z.enum(["pending", "ready", "failed"]);

export const articleDetailSchema = articleListItemSchema.extend({
  contentHtml: z.string().nullable(),
  contentText: z.string().nullable(),
  contentMarkdown: z.string().nullable(),
  contentStatus: contentStatusSchema,
  contentSource: contentSourceSchema,
  extractionErrorCode: z.string().nullable(),
  extractionErrorMessage: z.string().nullable(),
  readerOriginal: readerContentSchema,
  readerExtracted: readerContentSchema.nullable(),
  extractedContentStatus: extractedContentStatusSchema,
  extractedContentError: z.string().nullable(),
  extractedContentUpdatedAt: z.string().nullable(),
  defaultReaderMode: z.enum(["original", "extracted"]),
});

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

export const articleCountsSchema = z.object({
  unread: z.number(),
  saved: z.number(),
  today: z.number().optional(),
});

// ---------------------------------------------------------------------------
// Extract full text
// ---------------------------------------------------------------------------

export const extractFullTextResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    article: articleDetailSchema,
  }),
  z.object({
    ok: z.literal(false),
    errorCode: z.string(),
    errorMessage: z.string(),
    article: articleDetailSchema,
  }),
]);

// ---------------------------------------------------------------------------
// Feed types
// ---------------------------------------------------------------------------

export const discoverFeedResultSchema = z.object({
  id: z.string().nullable(),
  url: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  link: z.string().nullable(),
  isSubscribed: z.boolean(),
});

export const followFeedResultSchema = z.object({
  feedId: z.string(),
  subscriptionId: z.string(),
  url: z.string(),
  title: z.string(),
  link: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  faviconSource: z.string().nullable(),
  newFeed: z.boolean(),
  newSubscription: z.boolean(),
});

export const followedFeedSchema = z.object({
  subscriptionId: z.string(),
  feedId: z.string(),
  url: z.string(),
  title: z.string(),
  customTitle: z.string().nullable(),
  link: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  faviconSource: z.string().nullable(),
  isPinned: z.boolean(),
  pinnedAt: z.string().nullable(),
  folderId: z.string().nullable(),
  folderName: z.string().nullable(),
  subscribedAt: z.string(),
});

export const followedFeedsListSchema = z.object({
  items: z.array(followedFeedSchema),
});

/** Matches API `feeds.refresh_status` text column (not a closed enum in DB). */
export const feedRefreshStatusSchema = z.string();

export const feedDetailSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  customTitle: z.string().nullable(),
  description: z.string().nullable(),
  link: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  faviconSource: z.string().nullable(),
  faviconFetchedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isSubscribed: z.boolean(),
  subscriptionId: z.string().nullable(),
  subscribedAt: z.string().nullable(),
  isPinned: z.boolean(),
  pinnedAt: z.string().nullable(),
  refreshStatus: feedRefreshStatusSchema,
  lastRefreshStartedAt: z.string().nullable(),
  lastRefreshCompletedAt: z.string().nullable(),
  lastRefreshFailedAt: z.string().nullable(),
  lastRefreshError: z.string().nullable(),
  etag: z.string().nullable(),
  lastModified: z.string().nullable(),
  nextRefreshAt: z.string().nullable(),
});

export const messageResponseSchema = z.object({
  message: z.string(),
});

// ---------------------------------------------------------------------------
// Type exports (inferred from schemas)
// ---------------------------------------------------------------------------

export type ReaderContentDto = z.infer<typeof readerContentSchema>;
export type ArticleListItemDto = z.infer<typeof articleListItemSchema>;
export type CursorListResponseDto = z.infer<typeof cursorListResponseSchema>;
export type ArticleDetailDto = z.infer<typeof articleDetailSchema>;
export type ArticleCountsDto = z.infer<typeof articleCountsSchema>;
export type ExtractFullTextResponseDto = z.infer<typeof extractFullTextResponseSchema>;
export type DiscoverFeedResultDto = z.infer<typeof discoverFeedResultSchema>;
export type FollowFeedResultDto = z.infer<typeof followFeedResultSchema>;
export type FollowedFeedDto = z.infer<typeof followedFeedSchema>;
export type FeedDetailDto = z.infer<typeof feedDetailSchema>;

// ---------------------------------------------------------------------------
// Validated fetch helper
// ---------------------------------------------------------------------------

/**
 * Fetch JSON from the API and validate against a Zod schema. Throws a
 * descriptive error if the response doesn't match, catching API contract
 * drift before it reaches the UI.
 */
export async function apiJsonValidated<T>(
  schema: z.ZodType<T>,
  fetchFn: () => Promise<unknown>,
): Promise<T> {
  const raw = await fetchFn();
  const result = schema.safeParse(raw);
  if (!result.success) {
    console.error("[api-schema] Response validation failed:", result.error.issues);
    // In development, throw to surface the issue. In production, fall through
    // with the raw data to avoid breaking the UI for schema-compatible changes.
    if (process.env.NODE_ENV === "development") {
      throw new Error(
        `API response validation failed: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ")}`,
      );
    }
    return raw as T;
  }
  return result.data;
}
