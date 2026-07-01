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

export const feedRefreshStatusRowSchema = z.object({
  feedId: z.string(),
  refreshStatus: z.string(),
});

export const feedRefreshStatusListSchema = z.object({
  items: z.array(feedRefreshStatusRowSchema),
});

export const feedDetailSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  customTitle: z.string().nullable(),
  description: z.string().nullable(),
  link: z.string().nullable(),
  faviconUrl: z.string().nullable(),
  faviconSource: z.string().nullable(),
  faviconFetchedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isSubscribed: z.boolean(),
  subscriptionId: z.string().nullable(),
  subscribedAt: z.string().nullable(),
  isPinned: z.boolean(),
  pinnedAt: z.string().nullable(),
  refreshStatus: feedRefreshStatusSchema,
  lastRefreshStartedAt: z.string().nullable(),
  lastRefreshCompletedAt: z.string().nullable(),
  lastRefreshFailedAt: z.string().nullable(),
  lastRefreshError: z.string().nullable(),
  etag: z.string().nullable(),
  lastModified: z.string().nullable(),
  nextRefreshAt: z.string().nullable(),
});

export type DiscoverFeedResultDto = z.infer<typeof discoverFeedResultSchema>;
export type FollowFeedResultDto = z.infer<typeof followFeedResultSchema>;
export type FollowedFeedDto = z.infer<typeof followedFeedSchema>;
export type FeedDetailDto = z.infer<typeof feedDetailSchema>;
