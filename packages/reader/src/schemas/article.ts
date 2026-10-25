import { z } from "zod";
import { contentSourceSchema, readerContentSchema } from "./reader";

const contentStatusSchema = z.enum(["ready", "partial", "failed", "pending"]);
const articleTypeSchema = z.enum(["feed", "clip"]);

export const readingStateSchema = z.enum([
  "reading",
  "resurfacing",
  "completed",
  "dismissed",
  "abandoned",
]);

/** KDM only. Not sent on the HTML path. */
export const readingBlockAnchorSchema = z.object({
  kind: z.literal("block"),
  blockIndex: z.number().int().min(0).max(10_000),
  offset: z.number().min(0).max(1),
  fingerprint: z.string().max(32),
});

/** On every article list item and on article detail. Null when no row exists. */
export const readingProgressDtoSchema = z.object({
  progress: z.number(),
  maxProgress: z.number(),
  state: readingStateSchema,
  /** Engaged: maxProgress >= 0.05 and activeReadMs >= 20_000. Only engaged rows resurface. */
  engaged: z.boolean(),
  remainingMinutes: z.number().nullable(),
  lastReadAt: z.string(),
  completedAt: z.string().nullable(),
});

/** Detail only, for restore. */
export const readingPositionDtoSchema = z.object({
  progress: z.number(),
  anchor: readingBlockAnchorSchema.nullable(),
  contentKey: z.string(),
  updatedAt: z.string(),
});

export const readingProgressUpdateBodySchema = z.object({
  progress: z.number().min(0).max(1),
  anchor: readingBlockAnchorSchema.nullable(),
  contentKey: z.string().max(128),
  /** One per article open. */
  sessionId: z.uuid(),
  /** Cumulative active reading time for this session. */
  sessionActiveMs: z.number().int().min(0),
  /** The client saw the end of the content. */
  completed: z.boolean(),
  clientUpdatedAt: z.iso.datetime(),
});

export const articleListItemSchema = z.object({
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
  lastViewedAt: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  articleType: articleTypeSchema,
  readingProgress: readingProgressDtoSchema.nullable().default(null),
  categories: z
    .array(z.string())
    .optional()
    .transform((value) => value ?? []),
});

export const cursorListResponseSchema = z.object({
  items: z.array(articleListItemSchema),
  next_cursor: z.string().nullable(),
  has_more: z.boolean(),
  total_count: z.number().nullable(),
});

const extractedContentStatusSchema = z.enum(["pending", "ready", "failed"]);

export const articleDetailSchema = articleListItemSchema.extend({
  readingPosition: readingPositionDtoSchema.nullable().default(null),
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

export const articleCountsSchema = z.object({
  all: z.number().optional(),
  unread: z.number(),
  saved: z.number(),
  today: z.number().optional(),
});

export const extractFullTextResponseSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    status: z.enum(["ready", "queued"]),
    article: articleDetailSchema,
  }),
  z.object({
    ok: z.literal(false),
    status: z.literal("failed"),
    errorCode: z.string(),
    errorMessage: z.string(),
    article: articleDetailSchema,
  }),
]);

export type ReadingState = z.infer<typeof readingStateSchema>;
export type ReadingBlockAnchor = z.infer<typeof readingBlockAnchorSchema>;
export type ReadingProgressDto = z.infer<typeof readingProgressDtoSchema>;
export type ReadingPositionDto = z.infer<typeof readingPositionDtoSchema>;
export type ReadingProgressUpdateBody = z.infer<typeof readingProgressUpdateBodySchema>;
export type ArticleListItemDto = z.infer<typeof articleListItemSchema>;
export type CursorListResponseDto = z.infer<typeof cursorListResponseSchema>;
export type ArticleDetailDto = z.infer<typeof articleDetailSchema>;
export type ArticleCountsDto = z.infer<typeof articleCountsSchema>;
export type ExtractFullTextResponseDto = z.infer<typeof extractFullTextResponseSchema>;
