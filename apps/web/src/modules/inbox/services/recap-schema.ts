import { z } from "zod";

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
  articleType: articleTypeSchema,
});

export const inboxRecapFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  feedCount: z.number(),
});

export const inboxRecapTopViewedFeedSchema = z.object({
  feedId: z.string(),
  title: z.string(),
  url: z.string(),
  siteUrl: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  viewedItemCount: z.number(),
  lastViewedAt: z.string(),
  isSubscribed: z.boolean(),
  folderId: z.string().nullable(),
  folderName: z.string().nullable(),
});

export const inboxRecapSavedItemSchema = articleListItemSchema.extend({
  savedAt: z.string(),
});

export const inboxRecapSchema = z.object({
  folders: z.array(inboxRecapFolderSchema),
  topViewedFeeds: z.array(inboxRecapTopViewedFeedSchema),
  oldestSavedItems: z.array(inboxRecapSavedItemSchema),
});

export type InboxRecapDto = z.infer<typeof inboxRecapSchema>;
