import { eq } from "drizzle-orm";
import { feeds } from "@cronos/db";
import { pickHttpUrlForFaviconResolution, resolveFaviconUrlFromHttpUrl } from "@cronos/favicon";
import type { db } from "@adapters/db/client";
import { logger } from "@adapters/logger";

type DB = typeof db;

export { normalizeHttpUrlComparable as normalizeComparableUrl } from "@cronos/favicon";

/**
 * Resolve and persist favicon metadata. Safe to call when the feed row was just
 * updated from remote metadata; failures are logged and do not throw.
 */
export async function enrichFeedFaviconMetadataBestEffort(
  database: DB,
  feedId: string,
  incomingLink: string | null,
  feedUrl: string,
): Promise<void> {
  const site = pickHttpUrlForFaviconResolution(incomingLink, feedUrl);
  if (!site) {
    return;
  }

  try {
    const resolved = await resolveFaviconUrlFromHttpUrl(site);
    if (!resolved) {
      return;
    }
    await database
      .update(feeds)
      .set({
        faviconUrl: resolved.url,
        faviconSource: resolved.source,
        faviconFetchedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(feeds.id, feedId));
  } catch (error) {
    logger.warn("feeds.favicon.enrich_failed", {
      feedId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** Backfill favicon when missing (e.g. subscribe without remote re-fetch). */
export async function enrichFeedFaviconIfMissing(
  database: DB,
  feedId: string,
  link: string | null,
  feedUrl: string,
): Promise<void> {
  const rows = await database
    .select({ faviconUrl: feeds.faviconUrl })
    .from(feeds)
    .where(eq(feeds.id, feedId))
    .limit(1);
  if (rows[0]?.faviconUrl) {
    return;
  }
  await enrichFeedFaviconMetadataBestEffort(database, feedId, link, feedUrl);
}
