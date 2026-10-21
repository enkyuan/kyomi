import { z } from "zod";
import { readerBlockSchema } from "./block";
import { readerEmbedProviderSchema } from "./media";
import {
  anchorSchema,
  httpUrlSchema,
  readerContentSourceValues,
  readerImageSchema,
} from "./shared";

/**
 * Kyomi Document Model: the compiled, renderer-neutral article body.
 *
 * The worker compiler lowers every source format (feed HTML, extracted HTML, Markdown, text) into
 * this tree once, at ingest. Web, WebView, and native renderers map node types to components and
 * never re-parse or re-sanitize publisher HTML. See `docs/architecture/reader-document-compiler.md`.
 *
 * Bump `READER_DOCUMENT_VERSION` whenever a change would make an older renderer misread a
 * document; persisted documents with an older version are recompiled from retained source.
 */
export const READER_DOCUMENT_VERSION = 1 as const;

const footnoteSchema = z.object({
  id: anchorSchema,
  label: z.string().max(16),
  /** `sidenote` when the source authored margin notes; renderers may still choose popovers. */
  presentation: z.enum(["footnote", "sidenote"]),
  children: z.array(readerBlockSchema),
});

export const readerDocumentSchema = z.object({
  version: z.literal(READER_DOCUMENT_VERSION),
  source: z.object({
    format: z.enum(["html", "markdown", "text"]),
    origin: z.enum(readerContentSourceValues),
    baseUrl: httpUrlSchema.nullable(),
  }),
  compiler: z.object({
    version: z.string(),
    sanitizerVersion: z.string(),
  }),
  meta: z.object({
    title: z.string().nullable(),
    subtitle: z.string().nullable(),
    authors: z.array(z.object({ name: z.string(), url: httpUrlSchema.optional() })),
    siteName: z.string().nullable(),
    /** BCP 47 tag. */
    language: z.string().max(35).nullable(),
    direction: z.enum(["ltr", "rtl", "auto"]),
    publishedAt: z.iso.datetime().nullable(),
    updatedAt: z.iso.datetime().nullable(),
    wordCount: z.number().int().nonnegative(),
    readingMinutes: z.number().int().nonnegative(),
    /** Hero image, removed from `blocks` when it duplicated the first figure. */
    leadImage: readerImageSchema.nullable(),
  }),
  /** Derived flags so renderers lazy-load KaTeX CSS or embed chrome only when needed. */
  features: z.object({
    math: z.boolean(),
    codeLanguages: z.array(z.string()),
    embedProviders: z.array(readerEmbedProviderSchema),
  }),
  blocks: z.array(readerBlockSchema),
  footnotes: z.array(footnoteSchema),
  diagnostics: z.object({
    /** Source element counts removed by sanitize or chrome stripping, keyed by tag. */
    droppedElements: z.record(z.string(), z.number().int().nonnegative()),
    htmlBlocks: z.number().int().nonnegative(),
    warnings: z.array(z.string()).max(50),
  }),
});

export type ReaderDocument = z.infer<typeof readerDocumentSchema>;

export {
  readerBlockSchema,
  readerCalloutVariantSchema,
  readerCodeLanguageSourceSchema,
  type ReaderBlock,
  type ReaderListItem,
  type ReaderTableCell,
} from "./block";
export {
  readerInlineFormatSchema,
  readerInlineSchema,
  type ReaderInline,
  type ReaderInlineFormat,
} from "./inline";
export { readerEmbedProviderSchema, type ReaderEmbedProvider } from "./media";
export {
  readerImageSchema,
  readerPlacementSchema,
  type ReaderImage,
  type ReaderPlacement,
} from "./shared";
