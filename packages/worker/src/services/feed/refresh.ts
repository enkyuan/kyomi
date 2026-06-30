import { eq, sql } from "drizzle-orm";
import { feedItems, feeds } from "@kyomi/db";
import { resolveFeedFaviconUrl, tryFetchImageIfHostSafe } from "../favicon";
import { fetchArticleEnrichment } from "./enrich";
import { fetchFeedDocument } from "./fetch";
import { parseFeedDocument } from "./parse";
import { syncFeedToSearch } from "./search";
import { summarizeText } from "../../lib/feed-text";
import type {
  FeedIngestDatabase,
  FeedRefreshResult,
  ParsedFeedItem,
  SearchSyncConfig,
} from "./types";

const MAX_ENRICHMENTS_PER_REFRESH = 5;
const ENRICHMENT_CONCURRENCY = 3;

function computeFailureBackoffMs(snapshot: {
  lastRefreshSucceededAt: Date | null;
  lastRefreshFailedAt: Date | null;
}): number {
  const hasConsecutiveFailure =
    Boolean(snapshot.lastRefreshFailedAt) &&
    (!snapshot.lastRefreshSucceededAt ||
      snapshot.lastRefreshFailedAt!.getTime() >= snapshot.lastRefreshSucceededAt.getTime());
  return hasConsecutiveFailure ? 60 * 60 * 1000 : 15 * 60 * 1000;
}

function faviconSourceRank(source: string | null): number {
  switch (source) {
    case "html_link":
    case "feed_icon":
      return 3;
    case "google_s2":
    case "duckduckgo":
      return 2;
    case "favicon_ico":
      return 1;
    default:
      return 0;
  }
}

function shouldResolveFavicon({
  currentUrl,
  currentSource,
  linkChanged,
}: {
  currentUrl: string | null;
  currentSource: string | null;
  linkChanged: boolean;
}): boolean {
  return (
    !currentUrl || linkChanged || faviconSourceRank(currentSource) < faviconSourceRank("html_link")
  );
}

async function tryResolveFaviconMetadata(
  seedUrl: string,
  embeddedIconUrl?: string | null,
): Promise<{
  url: string;
  source: string;
} | null> {
  try {
    const websiteIcon = await resolveFeedFaviconUrl(seedUrl);
    if (websiteIcon) {
      return websiteIcon;
    }
  } catch (error) {
    console.warn("[ingestion] favicon resolution failed", {
      seedUrl,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (!embeddedIconUrl) {
    return null;
  }
  try {
    const response = await tryFetchImageIfHostSafe(embeddedIconUrl);
    if (!response) {
      return null;
    }
    response.body?.cancel().catch(() => {});
    return { url: embeddedIconUrl, source: "feed_icon" };
  } catch (error) {
    console.warn("[ingestion] embedded favicon resolution failed", {
      iconUrl: embeddedIconUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function runFeedRefresh(
  database: FeedIngestDatabase,
  feedId: string,
  searchSync?: SearchSyncConfig,
  options?: {
    enrichArticles?: boolean;
  },
): Promise<FeedRefreshResult> {
  try {
    const startedAt = new Date();
    await database
      .update(feeds)
      .set({
        refreshStatus: "running",
        lastRefreshStartedAt: startedAt,
        lastRefreshError: null,
      })
      .where(eq(feeds.id, feedId));

    const [feed] = await database
      .select({
        id: feeds.id,
        url: feeds.url,
        link: feeds.link,
        faviconUrl: feeds.faviconUrl,
        faviconSource: feeds.faviconSource,
        etag: feeds.etag,
        lastModified: feeds.lastModified,
        lastRefreshSucceededAt: feeds.lastRefreshSucceededAt,
        lastRefreshFailedAt: feeds.lastRefreshFailedAt,
      })
      .from(feeds)
      .where(eq(feeds.id, feedId))
      .limit(1);

    if (!feed) {
      return { ok: false, itemCount: 0, error: "Feed not found" };
    }

    const fetched = await fetchFeedDocument(feed.url, feed.etag, feed.lastModified);
    if (!fetched.ok) {
      const now = new Date();
      const backoffMs = computeFailureBackoffMs({
        lastRefreshSucceededAt: feed.lastRefreshSucceededAt,
        lastRefreshFailedAt: feed.lastRefreshFailedAt,
      });
      await database
        .update(feeds)
        .set({
          refreshStatus: "failed",
          lastRefreshFailedAt: now,
          lastRefreshError: fetched.error,
          lastRefreshCompletedAt: now,
          nextRefreshAt: new Date(now.getTime() + backoffMs),
        })
        .where(eq(feeds.id, feedId));
      return { ok: false, itemCount: 0, error: `Feed fetch failed: ${fetched.error}` };
    }

    if (fetched.notModified) {
      const now = new Date();
      let faviconPatch: {
        faviconUrl: string;
        faviconSource: string;
        faviconFetchedAt: Date;
        updatedAt: Date;
      } | null = null;
      if (
        shouldResolveFavicon({
          currentUrl: feed.faviconUrl,
          currentSource: feed.faviconSource,
          linkChanged: false,
        })
      ) {
        const seed = feed.link ?? feed.url;
        const resolved = await tryResolveFaviconMetadata(seed);
        if (resolved) {
          faviconPatch = {
            faviconUrl: resolved.url,
            faviconSource: resolved.source,
            faviconFetchedAt: now,
            updatedAt: now,
          };
        }
      }
      await database
        .update(feeds)
        .set({
          refreshStatus: "idle",
          lastRefreshCompletedAt: now,
          lastRefreshSucceededAt: now,
          lastRefreshError: null,
          etag: fetched.etag ?? feed.etag,
          lastModified: fetched.lastModified ?? feed.lastModified,
          nextRefreshAt: new Date(now.getTime() + 60 * 60 * 1000), // Next refresh in 1 hour
          ...(faviconPatch ?? {}),
        })
        .where(eq(feeds.id, feedId));
      return { ok: true, itemCount: 0, notModified: true };
    }

    const parsed = parseFeedDocument(fetched.body, feed.id, fetched.finalUrl);
    const now = new Date();
    const deduped = new Map<string, ParsedFeedItem>();
    for (const item of parsed.items) {
      // Ingestion owns canonical URL generation and in-memory dedupe before DB upsert.
      deduped.set(item.canonicalUrl, item);
    }
    const items = Array.from(deduped.values());
    // TODO: add language detection once we settle on the TS-side metadata/storage model.
    const enrichArticles = options?.enrichArticles ?? true;
    if (enrichArticles) {
      const enrichmentCandidates = items
        .filter((item) => !(item.contentText && item.contentText.length >= 220 && item.imageUrl))
        .slice(0, MAX_ENRICHMENTS_PER_REFRESH);

      for (let i = 0; i < enrichmentCandidates.length; i += ENRICHMENT_CONCURRENCY) {
        const batch = enrichmentCandidates.slice(i, i + ENRICHMENT_CONCURRENCY);
        await Promise.all(
          batch.map(async (item) => {
            const enrichment = await fetchArticleEnrichment(item.link);
            if ((!item.contentText || item.contentText.length < 220) && enrichment.content) {
              item.content = enrichment.content;
              item.contentHtml = enrichment.contentHtml;
              item.contentText = enrichment.contentText ?? enrichment.content;
              item.contentStatus = enrichment.contentStatus;
              item.contentSource = enrichment.contentSource;
              item.extractionErrorCode = enrichment.extractionErrorCode;
              item.extractionErrorMessage = enrichment.extractionErrorMessage;
              item.summary =
                summarizeText(enrichment.contentText ?? enrichment.content) ?? item.summary;
            }
            if (!item.imageUrl && enrichment.imageUrl) {
              item.imageUrl = enrichment.imageUrl;
            }
          }),
        );
      }
    }

    const prevLink = feed.link ?? null;
    const nextLink = parsed.metadata.link ?? null;
    const linkChanged = (prevLink ?? "") !== (nextLink ?? "");
    const needsFavicon = shouldResolveFavicon({
      currentUrl: feed.faviconUrl,
      currentSource: feed.faviconSource,
      linkChanged,
    });
    let faviconPatch: {
      faviconUrl: string;
      faviconSource: string;
      faviconFetchedAt: Date;
    } | null = null;
    if (needsFavicon) {
      const seed = nextLink ?? parsed.metadata.canonicalUrl;
      const resolved = await tryResolveFaviconMetadata(seed, parsed.metadata.iconUrl);
      if (resolved) {
        faviconPatch = {
          faviconUrl: resolved.url,
          faviconSource: resolved.source,
          faviconFetchedAt: now,
        };
      }
    }

    await database.transaction(async (tx) => {
      await tx
        .update(feeds)
        .set({
          url: parsed.metadata.canonicalUrl,
          title: parsed.metadata.title,
          description: parsed.metadata.description,
          link: parsed.metadata.link,
          updatedAt: now,
          refreshStatus: "idle",
          lastRefreshCompletedAt: now,
          lastRefreshSucceededAt: now,
          lastRefreshError: null,
          etag: fetched.etag,
          lastModified: fetched.lastModified,
          nextRefreshAt: new Date(now.getTime() + 60 * 60 * 1000),
          ...(faviconPatch ?? {}),
        })
        .where(eq(feeds.id, feed.id));

      if (items.length === 0) {
        return;
      }

      await tx
        .insert(feedItems)
        .values(
          items.map((item) => ({
            id: item.id,
            feedId: feed.id,
            canonicalUrl: item.canonicalUrl,
            title: item.title,
            link: item.link,
            summary: item.summary,
            content: item.content,
            contentHtml: item.contentHtml,
            contentText: item.contentText,
            contentMarkdown: item.contentMarkdown,
            contentStatus: item.contentStatus,
            contentSource: item.contentSource,
            extractionErrorCode: item.extractionErrorCode,
            extractionErrorMessage: item.extractionErrorMessage,
            imageUrl: item.imageUrl,
            publishedAt: item.publishedAt,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          // Primary identity lives in DB unique(feed_id, canonical_url).
          // Any list-time dedupe is defensive only.
          target: [feedItems.feedId, feedItems.canonicalUrl],
          set: {
            title: sql`CASE WHEN length(trim(excluded.title)) > length(trim(${feedItems.title})) THEN excluded.title ELSE ${feedItems.title} END`,
            link: sql`COALESCE(NULLIF(${feedItems.link}, ''), excluded.link)`,
            summary: sql`CASE WHEN length(COALESCE(excluded.summary, '')) > length(COALESCE(${feedItems.summary}, '')) THEN excluded.summary ELSE ${feedItems.summary} END`,
            content: sql`COALESCE(${feedItems.content}, excluded.content)`,
            contentHtml: sql`COALESCE(${feedItems.contentHtml}, excluded.content_html)`,
            contentText: sql`COALESCE(${feedItems.contentText}, excluded.content_text)`,
            contentMarkdown: sql`COALESCE(${feedItems.contentMarkdown}, excluded.content_markdown)`,
            contentStatus: sql`CASE WHEN ${feedItems.content} IS NULL AND excluded.content IS NOT NULL THEN excluded.content_status ELSE ${feedItems.contentStatus} END`,
            contentSource: sql`CASE WHEN ${feedItems.content} IS NULL AND excluded.content IS NOT NULL THEN excluded.content_source ELSE ${feedItems.contentSource} END`,
            extractionErrorCode: sql`COALESCE(${feedItems.extractionErrorCode}, excluded.extraction_error_code)`,
            extractionErrorMessage: sql`COALESCE(${feedItems.extractionErrorMessage}, excluded.extraction_error_message)`,
            imageUrl: sql`COALESCE(${feedItems.imageUrl}, excluded.image_url)`,
            publishedAt: sql`LEAST(${feedItems.publishedAt}, excluded.published_at)`,
            updatedAt: now,
          },
        });
    });

    await syncFeedToSearch(searchSync, {
      id: feed.id,
      ...parsed.metadata,
      iconUrl: faviconPatch?.faviconUrl ?? feed.faviconUrl ?? parsed.metadata.iconUrl,
    });

    return {
      ok: true,
      itemCount: items.length,
      insertedCount: items.length, // Rough estimate as we don't have exact UPSERT counts right now
    };
  } catch (error) {
    let message = "Feed refresh failed";
    if (error instanceof Error) {
      const cause = (error as Error & { cause?: unknown }).cause;
      message = cause instanceof Error ? cause.message : error.message;
    }
    const now = new Date();
    const backoffMs = 30 * 60 * 1000;
    await database
      .update(feeds)
      .set({
        refreshStatus: "failed",
        lastRefreshFailedAt: now,
        lastRefreshError: message,
        lastRefreshCompletedAt: now,
        nextRefreshAt: new Date(now.getTime() + backoffMs),
      })
      .where(eq(feeds.id, feedId))
      .catch(() => {});

    return {
      ok: false,
      itemCount: 0,
      error: message,
    };
  }
}
