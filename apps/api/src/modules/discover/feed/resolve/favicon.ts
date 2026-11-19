import { Effect } from "effect";
import {
  createDrizzleFaviconHostStore,
  resolvePersistedFeedFaviconUrl,
  tryFetchImageIfHostSafe,
} from "@kyomi/ingest/favicon";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { serializeError } from "@shared/errors/serialize";
import type { ResolvedRemoteFeed } from "./remote";

export type FeedFaviconEnrichment = { url: string; source: string } | null;

/** The feed's own icon, when its host is safe to fetch from and answers with an image. */
const resolveEmbeddedFeedIcon = (iconUrl: string | null) =>
  Effect.tryPromise(async (): Promise<FeedFaviconEnrichment> => {
    if (!iconUrl) {
      return null;
    }
    const response = await tryFetchImageIfHostSafe(iconUrl);
    if (!response) {
      return null;
    }
    response.body?.cancel().catch(() => {});
    return { url: iconUrl, source: "feed_icon" };
  });

/**
 * Best-effort favicon for a resolved feed: the website's persisted favicon first, then the icon the
 * feed embeds. A failure in either step is logged and skipped; this never fails the caller.
 */
export const resolveRemoteFeedFavicon = Effect.fn("discover.resolveFeedFavicon")(function* (
  resolved: ResolvedRemoteFeed,
) {
  const db = yield* Db;
  const log = yield* AppLogger;
  const faviconSeed = resolved.link?.trim() || resolved.canonicalUrl;

  const websiteFavicon = yield* Effect.tryPromise(() =>
    resolvePersistedFeedFaviconUrl(createDrizzleFaviconHostStore(db.client), faviconSeed),
  ).pipe(
    Effect.catch((error) =>
      log
        .warn("feeds.favicon.resolve_failed", { seed: faviconSeed, error: serializeError(error) })
        .pipe(Effect.as(null)),
    ),
  );
  if (websiteFavicon) {
    return websiteFavicon;
  }

  return yield* resolveEmbeddedFeedIcon(resolved.iconUrl).pipe(
    Effect.catch((error) =>
      log
        .warn("feeds.favicon.feed_icon_failed", {
          iconUrl: resolved.iconUrl,
          error: serializeError(error),
        })
        .pipe(Effect.as(null)),
    ),
  );
});
