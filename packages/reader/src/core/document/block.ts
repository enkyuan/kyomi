import { z } from "zod";
import { inlinesSchema, type ReaderInline } from "./inline";
import {
  audioBlockSchema,
  embedBlockSchema,
  figureBlockSchema,
  galleryBlockSchema,
  linkCardBlockSchema,
  videoBlockSchema,
} from "./media";
import {
  blockBase,
  dimensionSchema,
  hasMathSource,
  hexColorSchema,
  httpUrlSchema,
  mathFields,
  readerImageSchema,
  type ReaderImage,
} from "./shared";

const paragraphBlockSchema = z.object({
  ...blockBase,
  type: z.literal("paragraph"),
  children: inlinesSchema,
});

const headingBlockSchema = z.object({
  ...blockBase,
  type: z.literal("heading"),
  /** Normalized so the shallowest body heading is 2; the article title owns level 1. */
  level: z.number().int().min(2).max(6),
  children: inlinesSchema,
});

const listItemSchema = z.object({
  /** `null` for a normal item, boolean for a task-list item. */
  checked: z.boolean().nullable(),
  get children() {
    return z.array(readerBlockSchema);
  },
});

const listBlockSchema = z.object({
  ...blockBase,
  type: z.literal("list"),
  ordered: z.boolean(),
  start: z.number().int().optional(),
  items: z.array(listItemSchema),
});

const quoteBlockSchema = z.object({
  ...blockBase,
  type: z.literal("quote"),
  attribution: inlinesSchema.optional(),
  citeUrl: httpUrlSchema.optional(),
  get children() {
    return z.array(readerBlockSchema);
  },
});

const pullQuoteBlockSchema = z.object({
  ...blockBase,
  type: z.literal("pullQuote"),
  children: inlinesSchema,
  attribution: inlinesSchema.optional(),
});

const dividerBlockSchema = z.object({
  ...blockBase,
  type: z.literal("divider"),
});

/** How the compiler decided a code block's language, strongest first. */
export const readerCodeLanguageSourceSchema = z.enum([
  "explicit",
  "filename",
  "shebang",
  "classifier",
  "none",
]);

/**
 * Highlighted tokens are stored so clients ship no highlighter. Each line is a list of
 * `[text, styleIndex]` pairs indexing into `styles`; index 0 is the unstyled default.
 */
const codeHighlightSchema = z.object({
  /** Highlighter and theme pair, e.g. `shiki@4.5.0:github-light/github-dark`. */
  engine: z.string(),
  styles: z
    .array(
      z.object({
        light: hexColorSchema.optional(),
        dark: hexColorSchema.optional(),
        /** Bitmask: 1 italic, 2 bold, 4 underline. */
        fontStyle: z.number().int().min(0).max(7).optional(),
      }),
    )
    .min(1),
  lines: z.array(z.array(z.tuple([z.string(), z.number().int().nonnegative()]))),
});

const codeBlockSchema = z.object({
  ...blockBase,
  type: z.literal("code"),
  value: z.string(),
  /** Canonical language id (`typescript`), or `null` when rendered as plain text. */
  language: z.string().max(64).nullable(),
  languageSource: readerCodeLanguageSourceSchema,
  /** Display label, e.g. `TypeScript` or `Plain text`. */
  label: z.string().max(64),
  filename: z.string().max(256).optional(),
  /** 1-based line numbers the source marked for emphasis. */
  highlightLines: z.array(z.number().int().positive()).optional(),
  /** Absent when highlighting was skipped (plain text, size cap, or engine failure). */
  highlight: codeHighlightSchema.optional(),
});

const mathBlockSchema = z
  .object({ ...blockBase, type: z.literal("math"), ...mathFields })
  .refine(hasMathSource, "math requires tex or mathml");

const tableCellSchema = z.object({
  header: z.boolean(),
  colSpan: dimensionSchema.optional(),
  rowSpan: dimensionSchema.optional(),
  align: z.enum(["start", "center", "end"]).optional(),
  /** Cells hold blocks; renderers unwrap a lone paragraph. */
  get children() {
    return z.array(readerBlockSchema);
  },
});

const tableRowSchema = z.array(tableCellSchema);

const tableBlockSchema = z.object({
  ...blockBase,
  type: z.literal("table"),
  caption: inlinesSchema.optional(),
  head: z.array(tableRowSchema),
  body: z.array(tableRowSchema),
  foot: z.array(tableRowSchema).optional(),
});

/** GitHub alert variants; publisher callouts map onto the nearest one. */
export const readerCalloutVariantSchema = z.enum([
  "note",
  "tip",
  "important",
  "warning",
  "caution",
]);

const calloutBlockSchema = z.object({
  ...blockBase,
  type: z.literal("callout"),
  variant: readerCalloutVariantSchema,
  title: inlinesSchema.optional(),
  get children() {
    return z.array(readerBlockSchema);
  },
});

const detailsBlockSchema = z.object({
  ...blockBase,
  type: z.literal("details"),
  summary: inlinesSchema,
  open: z.boolean(),
  get children() {
    return z.array(readerBlockSchema);
  },
});

const definitionListItemSchema = z.object({
  terms: z.array(inlinesSchema).min(1),
  get definitions() {
    return z.array(z.array(readerBlockSchema));
  },
});

const definitionListBlockSchema = z.object({
  ...blockBase,
  type: z.literal("definitionList"),
  items: z.array(definitionListItemSchema),
});

/** Side-by-side media and text, e.g. WordPress media-text or author asides. */
const mediaTextBlockSchema = z.object({
  ...blockBase,
  type: z.literal("mediaText"),
  mediaPosition: z.enum(["start", "end"]),
  image: readerImageSchema,
  get children() {
    return z.array(readerBlockSchema);
  },
});

/**
 * Escape hatch for sanitized content the model cannot express yet. Counted in diagnostics so
 * the fidelity corpus can drive it toward zero.
 */
const htmlBlockSchema = z.object({
  ...blockBase,
  type: z.literal("html"),
  html: z.string(),
  reason: z.string().max(128),
});

type BlockAnchor = { anchor?: string | undefined };

export type ReaderListItem = { checked: boolean | null; children: ReaderBlock[] };

export type ReaderTableCell = {
  header: boolean;
  colSpan?: number | undefined;
  rowSpan?: number | undefined;
  align?: "start" | "center" | "end" | undefined;
  children: ReaderBlock[];
};

export type ReaderBlock =
  | z.infer<typeof paragraphBlockSchema>
  | z.infer<typeof headingBlockSchema>
  | (BlockAnchor & {
      type: "list";
      ordered: boolean;
      start?: number | undefined;
      items: ReaderListItem[];
    })
  | (BlockAnchor & {
      type: "quote";
      attribution?: ReaderInline[] | undefined;
      citeUrl?: string | undefined;
      children: ReaderBlock[];
    })
  | z.infer<typeof pullQuoteBlockSchema>
  | z.infer<typeof dividerBlockSchema>
  | z.infer<typeof codeBlockSchema>
  | z.infer<typeof mathBlockSchema>
  | (BlockAnchor & {
      type: "table";
      caption?: ReaderInline[] | undefined;
      head: ReaderTableCell[][];
      body: ReaderTableCell[][];
      foot?: ReaderTableCell[][] | undefined;
    })
  | z.infer<typeof figureBlockSchema>
  | z.infer<typeof galleryBlockSchema>
  | z.infer<typeof videoBlockSchema>
  | z.infer<typeof audioBlockSchema>
  | z.infer<typeof embedBlockSchema>
  | z.infer<typeof linkCardBlockSchema>
  | (BlockAnchor & {
      type: "callout";
      variant: z.infer<typeof readerCalloutVariantSchema>;
      title?: ReaderInline[] | undefined;
      children: ReaderBlock[];
    })
  | (BlockAnchor & {
      type: "details";
      summary: ReaderInline[];
      open: boolean;
      children: ReaderBlock[];
    })
  | (BlockAnchor & {
      type: "definitionList";
      items: { terms: ReaderInline[][]; definitions: ReaderBlock[][] }[];
    })
  | (BlockAnchor & {
      type: "mediaText";
      mediaPosition: "start" | "end";
      image: ReaderImage;
      children: ReaderBlock[];
    })
  | z.infer<typeof htmlBlockSchema>;

export const readerBlockSchema: z.ZodType<ReaderBlock> = z.discriminatedUnion("type", [
  paragraphBlockSchema,
  headingBlockSchema,
  listBlockSchema,
  quoteBlockSchema,
  pullQuoteBlockSchema,
  dividerBlockSchema,
  codeBlockSchema,
  mathBlockSchema,
  tableBlockSchema,
  figureBlockSchema,
  galleryBlockSchema,
  videoBlockSchema,
  audioBlockSchema,
  embedBlockSchema,
  linkCardBlockSchema,
  calloutBlockSchema,
  detailsBlockSchema,
  definitionListBlockSchema,
  mediaTextBlockSchema,
  htmlBlockSchema,
]);
