import { Cause, Effect } from "effect";
import { eq } from "drizzle-orm";
import { feeds } from "@kyomi/db";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { assertHttpOrHttpsUrl, normalizeFeedUrl } from "@modules/discover/feed/normalize";
import { resolveRemoteFeedFavicon } from "@modules/discover/feed/resolve/favicon";
import { resolveRemoteFeed, type ResolvedRemoteFeed } from "@modules/discover/feed/resolve/remote";
import { currentDate } from "@shared/effect/clock";
import { decodeText } from "@shared/text/entities";
import { FeedBackground } from "../service";
import { feedNotFound } from "../errors";
import type { FeedSubscribeResultDto } from "../types";
import {
  inTransaction,
  subscribeUserToFeed,
  upsertFeedRecord,
  type FaviconEnrichment,
  type SubscriptionInsertOptions,
} from "./persistence";
import { indexFeedForSearch } from "./search";

function resolveImmediateFavicon(resolved: ResolvedRemoteFeed): FaviconEnrichment {
  const embeddedIconUrl = resolved.iconUrl?.trim();
  if (!embeddedIconUrl) {
    return null;
  }
  return { url: embeddedIconUrl, source: "feed_icon" };
}

function normalizeExistingFeedLookupUrl(rawUrl: string): string | null {
  try {
    return normalizeFeedUrl(assertHttpOrHttpsUrl(rawUrl).href);
  } catch {
    return null;
  }
}

/** Subscribe to a feed row that already exists (no remote fetch). */
export const subscribeToExistingFeed = Effect.fn("feeds.subscription.subscribe_existing")(
  function* (userId: string, feedId: string, options?: SubscriptionInsertOptions) {
    const now = yield* currentDate;
    const subscribed = yield* inTransaction(
      "feeds.subscribe_existing",
      async (tx): Promise<FeedSubscribeResultDto | null> => {
        const feedRow = await tx
          .select({
            id: feeds.id,
            url: feeds.url,
            title: feeds.title,
            link: feeds.link,
            faviconUrl: feeds.faviconUrl,
            faviconSource: feeds.faviconSource,
          })
          .from(feeds)
          .where(eq(feeds.id, feedId))
          .limit(1);

        const feed = feedRow[0];
        if (!feed) {
          return null;
        }

        const { subscriptionId, newSubscription } = await subscribeUserToFeed(
          tx,
          userId,
          feed.id,
          now,
          options,
        );

        return {
          feedId: feed.id,
          subscriptionId,
          url: feed.url,
          title: decodeText(feed.title),
          link: feed.link,
          faviconUrl: feed.faviconUrl,
          faviconSource: feed.faviconSource,
          newFeed: false,
          newSubscription,
        };
      },
    );
    if (!subscribed) {
      return yield* feedNotFound();
    }
    return subscribed;
  },
);

const subscribeToExistingFeedByUrl = Effect.fn("feeds.subscription.subscribe_by_known_url")(
  function* (userId: string, rawUrl: string, options?: SubscriptionInsertOptions) {
    const normalizedUrl = normalizeExistingFeedLookupUrl(rawUrl);
    if (!normalizedUrl) {
      return null;
    }

    const db = yield* Db;
    const feedRow = yield* db.use("feeds.find_by_url", (client) =>
      client.select({ id: feeds.id }).from(feeds).where(eq(feeds.url, normalizedUrl)).limit(1),
    );
    const existingFeed = feedRow[0];
    if (!existingFeed) {
      return null;
    }

    return yield* subscribeToExistingFeed(userId, existingFeed.id, options);
  },
);

/** Probe the website's favicon and, when one is found, persist and re-index it. */
const enrichFavicon = Effect.fn("feeds.subscription.enrich_favicon")(function* (
  resolved: ResolvedRemoteFeed,
) {
  const enriched = yield* resolveRemoteFeedFavicon(resolved);
  if (!enriched) {
    return;
  }

  const now = yield* currentDate;
  const persisted = yield* inTransaction("feeds.favicon.persist", (tx) =>
    upsertFeedRecord(tx, resolved, enriched, now),
  );
  yield* indexFeedForSearch({
    id: persisted.feedId,
    url: resolved.canonicalUrl,
    title: decodeText(resolved.title),
    description: decodeText(resolved.description),
    link: resolved.link,
    faviconUrl: persisted.faviconUrl,
  });
});

/** `enrichFavicon` as background work: whatever goes wrong is logged with its cause chain. */
const enrichFaviconInBackground = Effect.fn("feeds.subscription.enrich_favicon_background")(
  function* (resolved: ResolvedRemoteFeed) {
    const log = yield* AppLogger;
    yield* enrichFavicon(resolved).pipe(
      Effect.catchCause((cause) =>
        log.warn("feeds.favicon.enrich_background_failed", {
          url: resolved.canonicalUrl,
          error: Cause.pretty(cause),
        }),
      ),
    );
  },
);

/**
 * Fetch feed document, upsert `feeds` by canonical URL, ensure
 * `feed_subscriptions` row for user, and index for search.
 */
export const createOrSubscribeToFeed = Effect.fn("feeds.subscription.create_or_subscribe")(
  function* (userId: string, rawUrl: string, options?: SubscriptionInsertOptions) {
    const background = yield* FeedBackground;
    const existing = yield* subscribeToExistingFeedByUrl(userId, rawUrl, options);
    if (existing) {
      return existing;
    }

    const resolved = yield* resolveRemoteFeed(rawUrl);

    // Never block subscription flow on remote favicon probing.
    const favicon: FaviconEnrichment = resolveImmediateFavicon(resolved);

    const now = yield* currentDate;
    const result = yield* inTransaction(
      "feeds.subscribe_create",
      async (tx): Promise<FeedSubscribeResultDto> => {
        const { feedId, newFeed, faviconUrl, faviconSource } = await upsertFeedRecord(
          tx,
          resolved,
          favicon,
          now,
        );
        const { subscriptionId, newSubscription } = await subscribeUserToFeed(
          tx,
          userId,
          feedId,
          now,
          options,
        );

        return {
          feedId,
          subscriptionId,
          url: resolved.canonicalUrl,
          title: decodeText(resolved.title),
          link: resolved.link,
          faviconUrl,
          faviconSource,
          newFeed,
          newSubscription,
        };
      },
    );

    yield* indexFeedForSearch({
      id: result.feedId,
      url: result.url,
      title: decodeText(result.title),
      description: decodeText(resolved.description),
      link: result.link,
      faviconUrl: result.faviconUrl,
    });

    if (!result.faviconUrl || result.faviconSource === "feed_icon") {
      yield* background.run(enrichFaviconInBackground(resolved));
    }

    return result;
  },
);
