/**
 * Public feed service surface — re-exports focused modules for stable imports.
 * Do not add implementation here; keep logic in the underlying service/mutation modules.
 *
 * Implementation: `feeds/read/service`, `feeds/subscription/service`, `feeds/subscription/mutations`.
 */

export {
  listSubscribedFeeds,
  getFeedDetailForUser,
  listFeedRefreshStatusesForUser,
} from "./read/service";
export { createOrSubscribeToFeed, subscribeToExistingFeed } from "./subscription/service";
export {
  assertUserSubscribedToFeed,
  bulkMoveFeedsToFolder,
  bulkUnsubscribeFromFeeds,
  unsubscribeFromFeed,
  updateFeedSubscriptionSettings,
} from "./subscription/mutations";
