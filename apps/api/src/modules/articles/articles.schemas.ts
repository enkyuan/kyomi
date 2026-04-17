import { t } from "elysia";
import { uuidParam } from "@shared/http/v1-stub";

export const readerContentSchema = t.Object({
  contentStatus: t.Union([
    t.Literal("ready"),
    t.Literal("partial"),
    t.Literal("failed"),
    t.Literal("pending"),
  ]),
  contentSource: t.Union([
    t.Literal("feed_html"),
    t.Literal("feed_markdown"),
    t.Literal("feed_summary"),
    t.Literal("extracted_html"),
    t.Literal("text_fallback"),
    t.Literal("link_only"),
  ]),
  bodyKind: t.Union([
    t.Literal("html"),
    t.Literal("markdown"),
    t.Literal("text"),
    t.Literal("fallback"),
  ]),
  title: t.Union([t.String(), t.Null()]),
  byline: t.Union([t.String(), t.Null()]),
  excerpt: t.Union([t.String(), t.Null()]),
  contentHtml: t.Union([t.String(), t.Null()]),
  contentMarkdown: t.Union([t.String(), t.Null()]),
  contentText: t.Union([t.String(), t.Null()]),
  fallbackSummary: t.Union([t.String(), t.Null()]),
  fallbackReason: t.Union([
    t.Literal("extraction_failed"),
    t.Literal("timeout"),
    t.Literal("missing_content"),
    t.Null(),
  ]),
  siteName: t.Union([t.String(), t.Null()]),
  language: t.Union([t.String(), t.Null()]),
  publishedTime: t.Union([t.String(), t.Null()]),
  notice: t.Union([t.String(), t.Null()]),
  extractionErrorCode: t.Union([t.String(), t.Null()]),
  extractionErrorMessage: t.Union([t.String(), t.Null()]),
  shouldExtract: t.Boolean(),
});

export const articleDetailSchema = t.Object({
  id: t.String(),
  title: t.String(),
  link: t.String(),
  summary: t.Union([t.String(), t.Null()]),
  contentHtml: t.Union([t.String(), t.Null()]),
  contentText: t.Union([t.String(), t.Null()]),
  contentMarkdown: t.Union([t.String(), t.Null()]),
  contentStatus: t.Union([
    t.Literal("ready"),
    t.Literal("partial"),
    t.Literal("failed"),
    t.Literal("pending"),
  ]),
  contentSource: t.Union([
    t.Literal("feed_html"),
    t.Literal("feed_markdown"),
    t.Literal("feed_summary"),
    t.Literal("extracted_html"),
    t.Literal("text_fallback"),
    t.Literal("link_only"),
  ]),
  extractionErrorCode: t.Union([t.String(), t.Null()]),
  extractionErrorMessage: t.Union([t.String(), t.Null()]),
  extractedContentHtml: t.Union([t.String(), t.Null()]),
  extractedContentText: t.Union([t.String(), t.Null()]),
  extractedContentStatus: t.Union([t.Literal("pending"), t.Literal("ready"), t.Literal("failed")]),
  extractedContentError: t.Union([t.String(), t.Null()]),
  extractedContentUpdatedAt: t.Union([t.String(), t.Null()]),
  publishedAt: t.String(),
  feedId: t.String(),
  feedTitle: t.String(),
  isRead: t.Boolean(),
  isSaved: t.Boolean(),
  articleType: t.Union([t.Literal("feed"), t.Literal("clip")]),
  reader: readerContentSchema,
});

export const extractResponseSchema = t.Object({
  reader: readerContentSchema,
  persisted: t.Boolean(),
});

export const articleListItemSchema = t.Object({
  id: t.String(),
  title: t.String(),
  link: t.String(),
  summary: t.Union([t.String(), t.Null()]),
  publishedAt: t.String(),
  feedId: t.String(),
  feedTitle: t.String(),
  isRead: t.Boolean(),
  isSaved: t.Boolean(),
  articleType: t.Union([t.Literal("feed"), t.Literal("clip")]),
});

export const cursorListResponseSchema = t.Object({
  items: t.Array(articleListItemSchema),
  next_cursor: t.Union([t.String(), t.Null()]),
  has_more: t.Boolean(),
  /** Accurate count on first page (no cursor). Returns 0 for cursor-paginated requests. */
  total_count: t.Number(),
});

export const countsResponseSchema = t.Object({
  unread: t.Number(),
  saved: t.Number(),
});

export const unreadCountsQuerySchema = t.Object({
  feed_ids: t.Optional(t.String()),
});

export const unreadCountsResponseSchema = t.Record(t.String(), t.Number());

export const savedCheckQuerySchema = t.Object({
  url: t.String({ minLength: 1 }),
});

export const savedCheckArticleSchema = t.Object({
  id: t.String(),
  title: t.String(),
  url: t.String(),
  articleType: t.Union([t.Literal("feed"), t.Literal("clip")]),
});

export const savedCheckResponseSchema = t.Object({
  is_saved: t.Boolean(),
  article: t.Union([savedCheckArticleSchema, t.Null()]),
});

export const messageResponseSchema = t.Object({
  message: t.String(),
});

export const summarizeBodySchema = t.Object({
  content: t.Optional(t.String()),
  language_key: t.Optional(t.String()),
});

export const summarizeResponseSchema = t.Object({
  summary: t.String(),
});

export const translateBodySchema = t.Object({
  content: t.Optional(t.String()),
  target_language: t.String({ minLength: 1 }),
});

export const translateResponseSchema = t.Object({
  translated_content: t.String(),
  target_language: t.String(),
});

export const createArticleClipBodySchema = t.Object({
  url: t.String({ minLength: 1 }),
  title: t.Optional(t.String()),
  content: t.Optional(t.String()),
  note: t.Optional(t.String()),
});

export const updateArticleBodySchema = t.Object({
  isRead: t.Optional(t.Union([t.Boolean(), t.Null()])),
  isSaved: t.Optional(t.Boolean()),
  title: t.Optional(t.String()),
  note: t.Optional(t.Union([t.String(), t.Null()])),
  contentHtml: t.Optional(t.Union([t.String(), t.Null()])),
  contentText: t.Optional(t.Union([t.String(), t.Null()])),
  contentMarkdown: t.Optional(t.Union([t.String(), t.Null()])),
  contentStatus: t.Optional(
    t.Union([
      t.Literal("ready"),
      t.Literal("partial"),
      t.Literal("failed"),
      t.Literal("pending"),
      t.Null(),
    ]),
  ),
  contentSource: t.Optional(
    t.Union([
      t.Literal("feed_html"),
      t.Literal("feed_markdown"),
      t.Literal("feed_summary"),
      t.Literal("extracted_html"),
      t.Literal("text_fallback"),
      t.Literal("link_only"),
      t.Null(),
    ]),
  ),
  extractionErrorCode: t.Optional(t.Union([t.String(), t.Null()])),
  extractionErrorMessage: t.Optional(t.Union([t.String(), t.Null()])),
  extractedContentHtml: t.Optional(t.Union([t.String(), t.Null()])),
  extractedContentText: t.Optional(t.Union([t.String(), t.Null()])),
  extractedContentStatus: t.Optional(
    t.Union([t.Literal("pending"), t.Literal("ready"), t.Literal("failed"), t.Null()]),
  ),
  extractedContentError: t.Optional(t.Union([t.String(), t.Null()])),
  extractedContentUpdatedAt: t.Optional(t.Union([t.String(), t.Null()])),
});

export const articleIdParamsSchema = t.Object({ articleId: uuidParam });
