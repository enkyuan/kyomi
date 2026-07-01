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

const contentStatusSchema = z.enum(["ready", "partial", "failed", "pending"]);

export const contentSourceSchema = z.enum([
  "feed_html",
  "feed_markdown",
  "feed_summary",
  "extracted_html",
  "text_fallback",
  "link_only",
]);

export const bodyKindSchema = z.enum(["html", "markdown", "text", "fallback"]);

const articleTypeSchema = z.enum(["feed", "clip"]);

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

const readerContentSchema = z.discriminatedUnion("bodyKind", [
  readerHtmlSchema,
  readerMarkdownSchema,
  readerTextSchema,
  readerFallbackSchema,
]);

// ---------------------------------------------------------------------------
// Article list items
// ---------------------------------------------------------------------------

const articleListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  link: z.string(),
  summary: z.string().nullable(),
  publishedAt: z.string(),
  feedId: z.string(),
  feedUrl: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  feedSiteUrl: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  feedTitle: z.string(),
  feedFaviconUrl: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
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

const extractedContentStatusSchema = z.enum(["pending", "ready", "failed"]);

export const articleDetailSchema = articleListItemSchema.extend({
  contentHtml: z.string().nullable(),
  contentText: z.string().nullable(),
  contentMarkdown: z.string().nullable(),
  contentStatus: contentStatusSchema,
  contentSource: contentSourceSchema,
  extractionErrorCode: z.string().nullable(),
  extractionErrorMessage: z.string().nullable(),
  reader: z.object({
    activeMode: z.enum(["original", "extracted"]),
    selected: readerContentSchema,
    original: z.object({
      available: z.boolean(),
      content: readerContentSchema,
    }),
    extracted: z.object({
      available: z.boolean(),
      content: readerContentSchema.nullable(),
      status: extractedContentStatusSchema,
      error: z.string().nullable(),
      updatedAt: z.string().nullable(),
    }),
  }),
});

// ---------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------

export const articleCountsSchema = z.object({
  all: z.number().optional(),
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
  faviconUrl: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
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

/** Matches API `feeds.refresh_status` text column (not a closed enum in DB). */
const feedRefreshStatusSchema = z.string();

const followedFeedSchema = z.object({
  subscriptionId: z.string(),
  feedId: z.string(),
  url: z.string(),
  title: z.string(),
  customTitle: z.string().nullable(),
  link: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  faviconSource: z.string().nullable(),
  refreshStatus: feedRefreshStatusSchema,
  isPinned: z.boolean(),
  pinnedAt: z.string().nullable(),
  folderId: z.string().nullable(),
  folderName: z.string().nullable(),
  subscribedAt: z.string(),
});

export const followedFeedsListSchema = z.object({
  items: z.array(followedFeedSchema),
});

export const feedRefreshStatusRowSchema = z.object({
  feedId: z.string(),
  refreshStatus: z.string(),
});

export const feedRefreshStatusListSchema = z.object({
  items: z.array(feedRefreshStatusRowSchema),
});

// ---------------------------------------------------------------------------
// Auth sessions
// ---------------------------------------------------------------------------

export const authSessionListRowSchema = z.object({
  id: z.string(),
  token: z.string(),
  ipAddress: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  userAgent: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  updatedAt: z.string(),
  expiresAt: z.string(),
  locationLabel: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  locationCity: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  locationRegion: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  locationCountry: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});

export const authSessionListSchema = z.array(authSessionListRowSchema);

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
// User preferences
// ---------------------------------------------------------------------------

const readerDefaultModeSchema = z.enum(["smart", "original", "extracted"]);
const readerContentWidthSchema = z.enum(["narrow", "wide"]);
const inboxDefaultViewSchema = z
  .union([
    z.literal("my-feed"),
    z.literal("all"),
    z.literal("saved"),
    z.literal("recent"),
    z.literal("inbox"),
    z.literal("today"),
    z.literal("unread"),
  ])
  .transform((value): "my-feed" | "all" | "saved" | "recent" =>
    value === "inbox" || value === "today" || value === "unread" ? "my-feed" : value,
  );
const inboxDensitySchema = z.enum(["comfortable", "compact"]);
const articleOpenBehaviorSchema = z.enum(["split", "reader"]);
const inboxMarkReadBehaviorSchema = z.enum(["on-open", "after-delay", "manual"]);
const inboxTimestampDisplaySchema = z.enum(["absolute", "relative"]);
const inboxTimestampHourCycleSchema = z.enum(["12h", "24h"]);

export const readerPreferencesSchema = z.object({
  defaultMode: readerDefaultModeSchema,
  fontSizePx: z.number(),
  contentWidth: readerContentWidthSchema,
  openLinksInNewTab: z.boolean(),
  showLinkPreviews: z.boolean(),
  showImages: z.boolean(),
});

export const inboxPreferencesSchema = z.object({
  inboxDefaultView: inboxDefaultViewSchema,
  inboxDensity: inboxDensitySchema,
  articleOpenBehavior: articleOpenBehaviorSchema,
  inboxMarkReadBehavior: inboxMarkReadBehaviorSchema,
  inboxTimestampDisplay: inboxTimestampDisplaySchema,
  inboxTimestampHourCycle: inboxTimestampHourCycleSchema,
  inboxFontSizePx: z.number(),
  inboxShowFavicons: z.boolean(),
});

export const userPreferencesSchema = readerPreferencesSchema.extend({
  inboxDefaultView: inboxDefaultViewSchema,
  inboxDensity: inboxDensitySchema,
  articleOpenBehavior: articleOpenBehaviorSchema,
  inboxMarkReadBehavior: inboxMarkReadBehaviorSchema,
  inboxTimestampDisplay: inboxTimestampDisplaySchema,
  inboxTimestampHourCycle: inboxTimestampHourCycleSchema,
  inboxFontSizePx: z.number(),
  inboxShowFavicons: z.boolean(),
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
export type ReaderDefaultModeDto = z.infer<typeof readerDefaultModeSchema>;
export type ReaderContentWidthDto = z.infer<typeof readerContentWidthSchema>;
export type ReaderPreferencesDto = z.infer<typeof readerPreferencesSchema>;
export type InboxDefaultViewDto = z.infer<typeof inboxDefaultViewSchema>;
export type InboxDensityDto = z.infer<typeof inboxDensitySchema>;
export type ArticleOpenBehaviorDto = z.infer<typeof articleOpenBehaviorSchema>;
export type InboxMarkReadBehaviorDto = z.infer<typeof inboxMarkReadBehaviorSchema>;
export type InboxTimestampDisplayDto = z.infer<typeof inboxTimestampDisplaySchema>;
export type InboxTimestampHourCycleDto = z.infer<typeof inboxTimestampHourCycleSchema>;
export type InboxPreferencesDto = z.infer<typeof inboxPreferencesSchema>;
export type UserPreferencesDto = z.infer<typeof userPreferencesSchema>;

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
