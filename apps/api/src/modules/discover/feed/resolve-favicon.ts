import {
  createDrizzleFaviconHostStore,
  resolvePersistedFeedFaviconUrl,
  tryFetchImageIfHostSafe,
  type FaviconDatabase,
} from "@kyomi/worker/favicon";
import type { AppLogger } from "@adapters/logger";
import type { ResolvedRemoteFeed } from "./resolve-remote";

export type FeedFaviconEnrichment = { url: string; source: string } | null;

async function resolveEmbeddedFeedIcon(iconUrl: string | null): Promise<FeedFaviconEnrichment> {
  if (!iconUrl) {
    return null;
  }
  const response = await tryFetchImageIfHostSafe(iconUrl);
  if (!response) {
    return null;
  }
  response.body?.cancel().catch(() => {});
  return { url: iconUrl, source: "feed_icon" };
}

export async function resolveRemoteFeedFavicon(
  database: FaviconDatabase,
  resolved: ResolvedRemoteFeed,
  logger?: AppLogger,
): Promise<FeedFaviconEnrichment> {
  const faviconSeed = resolved.link?.trim() || resolved.canonicalUrl;
  const faviconStore = createDrizzleFaviconHostStore(database);
  try {
    const websiteFavicon = await resolvePersistedFeedFaviconUrl(faviconStore, faviconSeed);
    if (websiteFavicon) {
      return websiteFavicon;
    }
  } catch (error) {
    logger?.warn("feeds.favicon.resolve_failed", {
      seed: faviconSeed,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    return await resolveEmbeddedFeedIcon(resolved.iconUrl);
  } catch (error) {
    logger?.warn("feeds.favicon.feed_icon_failed", {
      iconUrl: resolved.iconUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
