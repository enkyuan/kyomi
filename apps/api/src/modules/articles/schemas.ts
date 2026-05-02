import { t } from "elysia";
import { uuidParam } from "@shared/http/v1-stub";

export const extractedContentStatusSchema = t.Union([
  t.Literal("pending"),
  t.Literal("ready"),
  t.Literal("failed"),
]);

const readerContentCommonProperties = {
  contentStatus: t.Union([t.Literal("ready"), t.Literal("partial"), t.Literal("failed")]),
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
  contentBaseUrl: t.Union([t.String(), t.Null()]),
  title: t.Union([t.String(), t.Null()]),
  byline: t.Union([t.String(), t.Null()]),
  excerpt: t.Union([t.String(), t.Null()]),
  siteName: t.Union([t.String(), t.Null()]),
  language: t.Union([t.String(), t.Null()]),
  publishedTime: t.Union([t.String(), t.Null()]),
  notice: t.Union([t.String(), t.Null()]),
  extractionErrorCode: t.Union([t.String(), t.Null()]),
  extractionErrorMessage: t.Union([t.String(), t.Null()]),
  shouldExtract: t.Boolean(),
} as const;

export const readerContentSchema = t.Object({
  ...readerContentCommonProperties,
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
});

const readerFallbackReasonSchema = t.Union([
  t.Literal("extraction_failed"),
  t.Literal("timeout"),
  t.Literal("missing_content"),
]);

const readerHtmlSchema = t.Object({
  ...readerContentCommonProperties,
  bodyKind: t.Literal("html"),
  contentHtml: t.String(),
  contentMarkdown: t.Null(),
  contentText: t.Union([t.String(), t.Null()]),
  fallbackSummary: t.Null(),
  fallbackReason: t.Null(),
});

const readerMarkdownSchema = t.Object({
  ...readerContentCommonProperties,
  bodyKind: t.Literal("markdown"),
  contentHtml: t.Null(),
  contentMarkdown: t.String(),
  contentText: t.Union([t.String(), t.Null()]),
  fallbackSummary: t.Null(),
  fallbackReason: t.Null(),
});

const readerTextSchema = t.Object({
  ...readerContentCommonProperties,
  bodyKind: t.Literal("text"),
  contentHtml: t.Null(),
  contentMarkdown: t.Null(),
  contentText: t.String(),
  fallbackSummary: t.Null(),
  fallbackReason: t.Null(),
});

const readerFallbackSchema = t.Object({
  ...readerContentCommonProperties,
  bodyKind: t.Literal("fallback"),
  contentHtml: t.Null(),
  contentMarkdown: t.Null(),
  contentText: t.Null(),
  fallbackSummary: t.Union([t.String(), t.Null()]),
  fallbackReason: readerFallbackReasonSchema,
});

export const readerContentContractSchema = t.Union([
  readerHtmlSchema,
  readerMarkdownSchema,
  readerTextSchema,
  readerFallbackSchema,
]);

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
  publishedAt: t.String(),
  feedId: t.String(),
  feedTitle: t.String(),
  feedFaviconUrl: t.Union([t.String(), t.Null()]),
  isRead: t.Boolean(),
  isSaved: t.Boolean(),
  articleType: t.Union([t.Literal("feed"), t.Literal("clip")]),
  reader: t.Object({
    activeMode: t.Union([t.Literal("original"), t.Literal("extracted")]),
    selected: readerContentContractSchema,
    original: t.Object({
      available: t.Boolean(),
      content: readerContentContractSchema,
    }),
    extracted: t.Object({
      available: t.Boolean(),
      content: t.Union([readerContentContractSchema, t.Null()]),
      status: extractedContentStatusSchema,
      error: t.Union([t.String(), t.Null()]),
      updatedAt: t.Union([t.String(), t.Null()]),
    }),
  }),
});

export const extractFullTextResponseSchema = t.Union([
  t.Object({
    ok: t.Literal(true),
    article: articleDetailSchema,
  }),
  t.Object({
    ok: t.Literal(false),
    errorCode: t.String(),
    errorMessage: t.String(),
    article: articleDetailSchema,
  }),
]);

export const articleListItemSchema = t.Object({
  id: t.String(),
  title: t.String(),
  link: t.String(),
  summary: t.Union([t.String(), t.Null()]),
  publishedAt: t.String(),
  feedId: t.String(),
  feedTitle: t.String(),
  feedFaviconUrl: t.Union([t.String(), t.Null()]),
  isRead: t.Boolean(),
  isSaved: t.Boolean(),
  articleType: t.Union([t.Literal("feed"), t.Literal("clip")]),
});

export const cursorListResponseSchema = t.Object({
  items: t.Array(articleListItemSchema),
  next_cursor: t.Union([t.String(), t.Null()]),
  has_more: t.Boolean(),
  total_count: t.Null(),
});

export const articleCountsQuerySchema = t.Object({
  published_after: t.Optional(t.String()),
  published_before: t.Optional(t.String()),
  feed_id: t.Optional(t.String()),
  folder_id: t.Optional(t.String()),
});

export const countsResponseSchema = t.Object({
  all: t.Optional(t.Number()),
  unread: t.Number(),
  saved: t.Number(),
  today: t.Optional(t.Number()),
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

export const unreadCountsQuerySchema = t.Object({
  feed_ids: t.Optional(t.String()),
});

export const checkSavedQuerySchema = t.Object({
  url: t.String({ minLength: 1 }),
});

export const createClipBodySchema = t.Object({
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
});

export const articleIdParamsSchema = t.Object({ articleId: uuidParam });
