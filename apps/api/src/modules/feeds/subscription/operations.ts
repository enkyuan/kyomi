import { Effect } from "effect";
import { AppLogger } from "@adapters/logger/service";
import { enqueueFeedRefresh } from "../refresh/enqueue";
import { createOrSubscribeToFeed, subscribeToExistingFeed } from "./subscribe";

/** `POST /feeds`: subscribe by URL, and queue the first refresh of a new subscription. */
export const subscribeByUrl = Effect.fn("feeds.subscription.by_url")(function* (
  userId: string,
  url: string,
) {
  const log = yield* AppLogger;
  const result = yield* createOrSubscribeToFeed(userId, url.trim());
  if (result.newSubscription) {
    yield* enqueueFeedRefresh(result.feedId, userId, "subscription_created");
  }
  yield* log.info("feeds.subscribe.by_url", {
    userId,
    feedId: result.feedId,
    newFeed: result.newFeed,
    newSubscription: result.newSubscription,
  });
  return result;
});

/** `POST /feeds/:feedId/subscribe`: subscribe to a known feed, and queue its first refresh. */
export const subscribeById = Effect.fn("feeds.subscription.by_id")(function* (
  userId: string,
  feedId: string,
) {
  const log = yield* AppLogger;
  const result = yield* subscribeToExistingFeed(userId, feedId);
  if (result.newSubscription) {
    yield* enqueueFeedRefresh(result.feedId, userId, "subscription_created");
  }
  yield* log.info("feeds.subscribe.by_id", {
    userId,
    feedId: result.feedId,
    newSubscription: result.newSubscription,
  });
  return result;
});
