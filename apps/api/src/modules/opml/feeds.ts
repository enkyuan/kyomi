import { Context, type Effect } from "effect";
import type { FeedSubscribeResultDto } from "@modules/feeds/types";
import type { ApiError } from "@shared/effect/errors";

type SubscriptionOptions = { folderId: string | null; customTitle: string | null };

/**
 * What OPML imports need from the feeds and folders domains. Jobs depend on this narrow service
 * instead of the domains' operations, so OPML tests do not exercise subscription internals and
 * the domains' own requirements (search, HTTP, background work) stay out of OPML's.
 * `OpmlFeedsLive` (`./live`) is the implementation.
 */
export type OpmlFeedsShape = {
  /** Subscribe to the feed behind `url`, fetching and creating the feed row when it is new. */
  readonly subscribeToFeedUrl: (
    userId: string,
    url: string,
    options: SubscriptionOptions,
  ) => Effect.Effect<FeedSubscribeResultDto, ApiError>;
  /** Subscribe to a feed row that already exists (no remote fetch). */
  readonly subscribeToKnownFeed: (
    userId: string,
    feedId: string,
    options: SubscriptionOptions,
  ) => Effect.Effect<FeedSubscribeResultDto, ApiError>;
  /** Queue the first refresh of a newly subscribed feed. */
  readonly requestInitialRefresh: (feedId: string, userId: string) => Effect.Effect<void, ApiError>;
  /** Folder ids by name, creating the folders that do not exist yet. */
  readonly ensureFolders: (
    userId: string,
    names: string[],
  ) => Effect.Effect<Map<string, string>, ApiError>;
  readonly getOrCreateFolder: (
    userId: string,
    name: string,
  ) => Effect.Effect<{ id: string }, ApiError>;
};

export class OpmlFeeds extends Context.Service<OpmlFeeds, OpmlFeedsShape>()("kyomi/OpmlFeeds") {}
