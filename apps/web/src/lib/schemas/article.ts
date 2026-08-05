import { z } from "zod";
import { contentSourceSchema, readerContentSchema } from "./reader";

const contentStatusSchema = z.enum(["ready", "partial", "failed", "pending"]);
const articleTypeSchema = z.enum(["feed", "clip"]);

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
  lastViewedAt: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  articleType: articleTypeSchema,
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

export type ArticleListItemDto = z.infer<typeof articleListItemSchema>;
export type CursorListResponseDto = z.infer<typeof cursorListResponseSchema>;
export type ArticleDetailDto = z.infer<typeof articleDetailSchema>;
export type ArticleCountsDto = z.infer<typeof articleCountsSchema>;
export type ExtractFullTextResponseDto = z.infer<typeof extractFullTextResponseSchema>;
