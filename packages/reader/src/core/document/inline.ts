import { z } from "zod";
import {
  anchorSchema,
  fragmentHrefSchema,
  hasMathSource,
  httpUrlSchema,
  mathFields,
  readerImageSchema,
} from "./shared";

export const readerInlineFormatSchema = z.enum([
  "strong",
  "emphasis",
  "underline",
  "strike",
  "insert",
  "subscript",
  "superscript",
  "highlight",
  "small",
  "keyboard",
  "cite",
  "quote",
]);

const textInlineSchema = z.object({
  type: z.literal("text"),
  value: z.string(),
});

const formatInlineSchema = z.object({
  type: z.literal("format"),
  format: readerInlineFormatSchema,
  get children() {
    return z.array(readerInlineSchema);
  },
});

const codeInlineSchema = z.object({
  type: z.literal("code"),
  value: z.string(),
});

/** Links never nest; the compiler unwraps inner links. */
const linkInlineSchema = z.object({
  type: z.literal("link"),
  href: z.union([httpUrlSchema, fragmentHrefSchema]),
  title: z.string().optional(),
  get children() {
    return z.array(readerInlineSchema);
  },
});

const abbrInlineSchema = z.object({
  type: z.literal("abbr"),
  title: z.string(),
  get children() {
    return z.array(readerInlineSchema);
  },
});

const breakInlineSchema = z.object({
  type: z.literal("break"),
});

const mathInlineSchema = z
  .object({ type: z.literal("math"), ...mathFields })
  .refine(hasMathSource, "math requires tex or mathml");

const footnoteRefInlineSchema = z.object({
  type: z.literal("footnoteRef"),
  /** Matches a `footnotes[].id` in the same document. */
  id: anchorSchema,
  label: z.string().max(16),
});

/** Inline images such as emoji or icons; block images use `figure`. */
const imageInlineSchema = z.object({
  type: z.literal("image"),
  image: readerImageSchema,
});

export type ReaderInlineFormat = z.infer<typeof readerInlineFormatSchema>;

/**
 * Recursive node types are written out because Zod cannot infer a union that contains itself;
 * annotating the schema with them makes TypeScript check that the two agree.
 */
export type ReaderInline =
  | z.infer<typeof textInlineSchema>
  | { type: "format"; format: ReaderInlineFormat; children: ReaderInline[] }
  | z.infer<typeof codeInlineSchema>
  | { type: "link"; href: string; title?: string | undefined; children: ReaderInline[] }
  | { type: "abbr"; title: string; children: ReaderInline[] }
  | z.infer<typeof breakInlineSchema>
  | z.infer<typeof mathInlineSchema>
  | z.infer<typeof footnoteRefInlineSchema>
  | z.infer<typeof imageInlineSchema>;

export const readerInlineSchema: z.ZodType<ReaderInline> = z.discriminatedUnion("type", [
  textInlineSchema,
  formatInlineSchema,
  codeInlineSchema,
  linkInlineSchema,
  abbrInlineSchema,
  breakInlineSchema,
  mathInlineSchema,
  footnoteRefInlineSchema,
  imageInlineSchema,
]);

export const inlinesSchema = z.array(readerInlineSchema);
