import { z } from "zod";

export const discoverFeedResultSchema = z.object({
  id: z.string().nullable(),
  url: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  link: z.string().nullable(),
  faviconUrl: z
    .string()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  isSubscribed: z.boolean(),
});

export const followFeedResultSchema = z.object({
  feedId: z.string(),
  subscriptionId: z.string(),
  url: z.string(),
  title: z.string(),
  link: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  faviconSource: z.string().nullable(),
  newFeed: z.boolean(),
  newSubscription: z.boolean(),
});

/** Matches API `feeds.refresh_status` text column (not a closed enum in DB). */
const feedRefreshStatusSchema = z.string();

const followedFeedSchema = z.object({
  subscriptionId: z.string(),
  feedId: z.string(),
  url: z.string(),
  title: z.string(),
  customTitle: z.string().nullable(),
  link: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  faviconSource: z.string().nullable(),
  refreshStatus: feedRefreshStatusSchema,
  isPinned: z.boolean(),
  pinnedAt: z.string().nullable(),
  folderId: z.string().nullable(),
  folderName: z.string().nullable(),
  subscribedAt: z.string(),
});

export const followedFeedsListSchema = z.object({
  items: z.array(followedFeedSchema),
});

export type DiscoverFeedResultDto = z.infer<typeof discoverFeedResultSchema>;
export type FollowFeedResultDto = z.infer<typeof followFeedResultSchema>;
export type FollowedFeedDto = z.infer<typeof followedFeedSchema>;
