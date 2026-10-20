import { z } from "zod";
import type { ReaderContentSource } from "../types";

export const httpUrlSchema = z.url({ protocol: /^https?$/ });

/** Same-document link target produced by the compiler (footnotes, headings). */
export const fragmentHrefSchema = z.string().regex(/^#[a-z0-9][a-z0-9-]{0,63}$/);

/** Compiler-assigned anchor. Renderers prefix it (e.g. `kyomi-`) to avoid DOM clobbering. */
export const anchorSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);

/** Renderers interpolate colours into `style`, so only plain hex is accepted. */
export const hexColorSchema = z.string().regex(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i);

export const dimensionSchema = z.number().int().positive();

/** Author intent for media width, mapped to the reader's breakout grid lines. */
export const readerPlacementSchema = z.enum(["content", "wide", "full", "start", "end"]);

export const readerContentSourceValues = [
  "feed_html",
  "feed_markdown",
  "feed_summary",
  "extracted_html",
  "text_fallback",
  "link_only",
] as const satisfies readonly ReaderContentSource[];

export const readerImageSchema = z.object({
  src: httpUrlSchema,
  alt: z.string(),
  width: dimensionSchema.optional(),
  height: dimensionSchema.optional(),
  srcset: z
    .array(
      z.object({
        url: httpUrlSchema,
        width: dimensionSchema.optional(),
        density: z.number().positive().optional(),
      }),
    )
    .optional(),
  /** Base64 thumbhash rendered while the image loads. */
  placeholder: z.string().max(64).optional(),
  /** Set when the source wrapped the image in a link. */
  href: httpUrlSchema.optional(),
});

/**
 * Math is stored as source plus compiler output. `rendered` is KaTeX HTML produced by the
 * compiler with `trust: false`; it is the only HTML renderers may inject besides `html` blocks.
 */
export const mathFields = {
  tex: z.string().max(20_000).optional(),
  /** Publisher MathML, sanitized against the MathML allowlist. */
  mathml: z.string().optional(),
  rendered: z.string().optional(),
};

export const hasMathSource = (value: { tex?: string; mathml?: string }) =>
  value.tex !== undefined || value.mathml !== undefined;

export const blockBase = {
  /** Preserved or generated anchor for in-document links. */
  anchor: anchorSchema.optional(),
};

export type ReaderPlacement = z.infer<typeof readerPlacementSchema>;
export type ReaderImage = z.infer<typeof readerImageSchema>;
