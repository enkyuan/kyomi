/**
 * Public feed service surface — re-exports focused modules for stable imports.
 * Implementation: `feeds.read.service`, `feeds.subscription.service`, `feeds.subscription-mutations`.
 */

export { listSubscribedFeeds, getFeedDetailForUser } from "./feeds.read.service";
export { createOrSubscribeToFeed, subscribeToExistingFeed } from "./feeds.subscription.service";
export {
  assertUserSubscribedToFeed,
  bulkMoveFeedsToFolder,
  bulkUnsubscribeFromFeeds,
  unsubscribeFromFeed,
  updateFeedSubscriptionSettings,
} from "./feeds.subscription-mutations";
