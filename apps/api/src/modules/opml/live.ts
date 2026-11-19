import { Effect, Layer } from "effect";
import { Db } from "@adapters/db/service";
import type { FeedsServices } from "@modules/feeds/runtime";
import { enqueueFeedRefresh } from "@modules/feeds/refresh/enqueue";
import {
  createOrSubscribeToFeed,
  subscribeToExistingFeed,
} from "@modules/feeds/subscription/subscribe";
import { ensureFolders, getOrCreateFolder } from "@modules/folders/operations";
import { OpmlFeeds } from "./feeds";

/**
 * `OpmlFeeds` over the feeds and folders domains. Each operation runs against the services this
 * layer was built with, so OPML code needs only `OpmlFeeds` in its own requirements.
 */
export const OpmlFeedsLive = Layer.effect(
  OpmlFeeds,
  Effect.gen(function* () {
    const services = yield* Effect.context<FeedsServices>();
    const { client } = yield* Db;
    return OpmlFeeds.of({
      subscribeToFeedUrl: (userId, url, options) =>
        createOrSubscribeToFeed(userId, url, options).pipe(Effect.provideContext(services)),
      subscribeToKnownFeed: (userId, feedId, options) =>
        subscribeToExistingFeed(userId, feedId, options).pipe(Effect.provideContext(services)),
      requestInitialRefresh: (feedId, userId) =>
        enqueueFeedRefresh(feedId, userId, "subscription_created").pipe(
          Effect.provideContext(services),
          Effect.asVoid,
        ),
      ensureFolders: (userId, names) => ensureFolders(client, userId, names),
      getOrCreateFolder: (userId, name) => getOrCreateFolder(client, userId, name),
    });
  }),
);
