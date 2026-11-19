import { Effect } from "effect";
import { assertUserSubscribedToFeed } from "../subscription/mutations";
import { enqueueBatchFeedRefresh, enqueueFeedRefresh } from "./enqueue";
import { listRefreshableFeedIdsForUser } from "./selection";

/** `POST /feeds/:feedId/refresh`: an explicit action that always flows queue, worker, ingestion. */
export const refreshFeedForUser = Effect.fn("feeds.refresh.request")(function* (
  userId: string,
  feedId: string,
) {
  yield* assertUserSubscribedToFeed(userId, feedId);
  const { jobId } = yield* enqueueFeedRefresh(feedId, userId, "manual");
  return { accepted: true as const, jobId, type: "feed.refresh" as const };
});

/** `POST /feeds/refresh`: every subscribed feed, or only those in `folderId`. */
export const refreshFeedsForUser = Effect.fn("feeds.refresh.request_batch")(function* (
  userId: string,
  folderId?: string,
) {
  const feedIds = yield* listRefreshableFeedIdsForUser(userId, folderId);
  return yield* enqueueBatchFeedRefresh(feedIds, userId, "manual");
});
