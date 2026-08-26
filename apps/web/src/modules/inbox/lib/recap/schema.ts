import { articleListItemSchema } from "@kyomi/reader/schemas";
import { z } from "zod";

export const inboxRecapFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  isPinned: z.boolean().optional().default(false),
  pinnedAt: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
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
