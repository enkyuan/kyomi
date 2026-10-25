export const foldersQueryKey = ["feeds", "folders"] as const;

/** Prefix of every query over the feeds the user follows; invalidate it to refresh them all. */
export const subscribedFeedsQueryKey = ["feeds", "subscribed"] as const;

/** The followed feeds with their folders, one level below the inbox's own `subscribedFeedsQueryKey` data. */
export const subscribedFeedListQueryKey = [...subscribedFeedsQueryKey, "list"] as const;
