import { z } from "zod";
import { inlinesSchema } from "./inline";
import {
  blockBase,
  dimensionSchema,
  httpUrlSchema,
  readerImageSchema,
  readerPlacementSchema,
} from "./shared";

export const figureBlockSchema = z.object({
  ...blockBase,
  type: z.literal("figure"),
  placement: readerPlacementSchema,
  image: readerImageSchema,
  caption: inlinesSchema.optional(),
  credit: inlinesSchema.optional(),
});

export const galleryBlockSchema = z.object({
  ...blockBase,
  type: z.literal("gallery"),
  placement: readerPlacementSchema,
  layout: z.enum(["grid", "carousel"]),
  items: z
    .array(
      z.object({
        image: readerImageSchema,
        caption: inlinesSchema.optional(),
      }),
    )
    .min(2),
  caption: inlinesSchema.optional(),
});

const mediaSourceSchema = z.object({
  url: httpUrlSchema,
  mimeType: z.string().max(128).optional(),
});

/** Direct media files. Hosted players (YouTube, Vimeo) are `embed` blocks. */
export const videoBlockSchema = z.object({
  ...blockBase,
  type: z.literal("video"),
  placement: readerPlacementSchema,
  sources: z.array(mediaSourceSchema).min(1),
  poster: httpUrlSchema.optional(),
  width: dimensionSchema.optional(),
  height: dimensionSchema.optional(),
  caption: inlinesSchema.optional(),
});

export const audioBlockSchema = z.object({
  ...blockBase,
  type: z.literal("audio"),
  sources: z.array(mediaSourceSchema).min(1),
  title: z.string().optional(),
  durationSeconds: z.number().nonnegative().optional(),
  caption: inlinesSchema.optional(),
});

export const readerEmbedProviderSchema = z.enum([
  "youtube",
  "vimeo",
  "x",
  "bluesky",
  "mastodon",
  "threads",
  "instagram",
  "tiktok",
  "spotify",
  "soundcloud",
  "apple-podcasts",
  "github-gist",
  "codepen",
  "codesandbox",
  "loom",
  "figma",
]);

/** Static copy of a third-party post, fetched server-side so no provider script runs. */
const embedSnapshotSchema = z.object({
  title: z.string().optional(),
  text: inlinesSchema.optional(),
  author: z
    .object({
      name: z.string(),
      handle: z.string().optional(),
      url: httpUrlSchema.optional(),
      avatar: readerImageSchema.optional(),
    })
    .optional(),
  publishedAt: z.iso.datetime().optional(),
  thumbnail: readerImageSchema.optional(),
  media: z.array(readerImageSchema).optional(),
  fetchedAt: z.iso.datetime(),
});

export const embedBlockSchema = z.object({
  ...blockBase,
  type: z.literal("embed"),
  provider: readerEmbedProviderSchema,
  placement: readerPlacementSchema,
  /** Canonical public URL of the embedded item; also the link-card fallback. */
  url: httpUrlSchema,
  /** Provider id (video id, post URI) used to build `frameUrl`. */
  providerId: z.string().max(256).optional(),
  /**
   * Iframe URL built by the compiler from the provider allowlist template, never copied from
   * source markup. Absent for snapshot-only providers.
   */
  frameUrl: httpUrlSchema.optional(),
  /** width / height of the player box, reserved before load. */
  aspectRatio: z.number().positive().optional(),
  snapshot: embedSnapshotSchema.optional(),
  caption: inlinesSchema.optional(),
});

export const linkCardBlockSchema = z.object({
  ...blockBase,
  type: z.literal("linkCard"),
  url: httpUrlSchema,
  title: z.string().optional(),
  description: z.string().optional(),
  siteName: z.string().optional(),
  image: readerImageSchema.optional(),
});

export type ReaderEmbedProvider = z.infer<typeof readerEmbedProviderSchema>;
