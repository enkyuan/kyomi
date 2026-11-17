import { Effect } from "effect";
import { AppLogger } from "@adapters/logger/service";
import { FeedSearch, type FeedSearchDocument } from "@adapters/search/service";
import { serializeError } from "@shared/errors/serialize";

/**
 * Index the feed in the search engine. The subscription already committed, so a failure is logged
 * with its cause instead of failing the request: search indexing failures stay visible in telemetry.
 */
export const indexFeedForSearch = Effect.fn("feeds.subscription.index_search")(function* (
  metadata: FeedSearchDocument,
) {
  const search = yield* FeedSearch;
  const log = yield* AppLogger;
  yield* search.upsert([metadata]).pipe(
    Effect.catch((error) =>
      log.warn("feeds.search_index.failed", {
        feedId: metadata.id,
        url: metadata.url,
        error: serializeError(error),
      }),
    ),
  );
});
