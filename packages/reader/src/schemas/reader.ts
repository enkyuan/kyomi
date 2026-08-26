import { z } from "zod";

export const contentSourceSchema = z.enum([
  "feed_html",
  "feed_markdown",
  "feed_summary",
  "extracted_html",
  "text_fallback",
  "link_only",
]);

export const bodyKindSchema = z.enum(["html", "markdown", "text", "fallback"]);

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

export type ReaderContentDto = z.infer<typeof readerContentSchema>;
