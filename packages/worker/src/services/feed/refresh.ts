import { eq, sql } from "drizzle-orm";
import { canonicalizeCategoryLabels, feedItems, feeds } from "@kyomi/db";
import {
  createDrizzleFaviconHostStore,
  faviconSourceRank,
  resolvePersistedFeedFaviconUrl,
  tryFetchImageIfHostSafe,
} from "../favicon";
import {
  classifyFeedCategories,
  classifyFeedItemCategories,
  isMixedFeedHost,
  type InferredCategoryLabel,
} from "./classifier";
import { fetchArticleEnrichment } from "./enrich";
import { fetchFeedDocument } from "./fetch";
import { parseFeedDocument } from "./parse";
import { syncFeedToSearch } from "./search";
import {
  hasExplicitFeedCategories,
  syncInferredFeedCategories,
  syncParsedFeedCategories,
} from "./categories";
import { summarizeText } from "../../lib/feed-text";
import type {
  FeedIngestDatabase,
  FeedMetadata,
  FeedRefreshResult,
  HostRateLimiter,
  ParsedFeedDocument,
  ParsedFeedItem,
  SearchSyncConfig,
} from "./types";

const MAX_ENRICHMENTS_PER_REFRESH = 5;
const ENRICHMENT_CONCURRENCY = 3;
const PERMANENT_FAILURE_BACKOFF_MS = 24 * 60 * 60 * 1000;

export function shouldEnrichInsertedItems(input: { userId: string; reason?: string }): boolean {
  if (
    input.userId === "system" &&
    (input.reason === "scheduled" || input.reason === "global_scheduled")
  ) {
    return false;
  }

  return true;
}

function isPermanentHttpStatus(status: number | undefined): boolean {
  // 4xx failures other than 408 (Request Timeout) and 429 (Too Many Requests)
  // will not resolve on retry — back off aggressively.
  if (status === undefined) return false;
  if (status === 408 || status === 429) return false;
  return status >= 400 && status < 500;
}

function computeFailureBackoffMs(
  snapshot: {
    lastRefreshSucceededAt: Date | null;
    lastRefreshFailedAt: Date | null;
  },
  permanent: boolean,
): number {
  if (permanent) return PERMANENT_FAILURE_BACKOFF_MS;
  const hasConsecutiveFailure =
    Boolean(snapshot.lastRefreshFailedAt) &&
    (!snapshot.lastRefreshSucceededAt ||
      snapshot.lastRefreshFailedAt!.getTime() >= snapshot.lastRefreshSucceededAt.getTime());
  return hasConsecutiveFailure ? 60 * 60 * 1000 : 15 * 60 * 1000;
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

/**
 * Classifies feed-level categories when the parsed document's RSS/Atom/JSON Feed category
 * tags don't map to any canonical category. Feed-level classification does not depend on
 * item content, so it can run before article enrichment.
 */
function classifyFeedLevelCategories(input: {
  feed: { url: string; link: string | null; sourceKind: string | null };
  parsed: ParsedFeedDocument;
}): InferredCategoryLabel[] {
  if (canonicalizeCategoryLabels(input.parsed.metadata.categoryLabels).length > 0) {
    return [];
  }
  return classifyFeedCategories({
    feedTitle: input.parsed.metadata.title,
    feedDescription: input.parsed.metadata.description,
    feedUrl: input.parsed.metadata.canonicalUrl || input.feed.url,
    feedSiteUrl: input.parsed.metadata.link ?? input.feed.link,
    sourceKind: input.feed.sourceKind,
  }).categories;
}

function isMixedFeed(input: {
  feed: { url: string; link: string | null };
  parsed: ParsedFeedDocument;
}): boolean {
  return (
    isMixedFeedHost(input.parsed.metadata.canonicalUrl) ||
    isMixedFeedHost(input.parsed.metadata.link) ||
    isMixedFeedHost(input.feed.url) ||
    isMixedFeedHost(input.feed.link)
  );
}

/**
 * Classifies item-level categories, only on known mixed/aggregator feeds (e.g. Hacker News)
 * so single-topic feeds do not get noisy per-item labels. Must run after article enrichment
 * so items with a thin/empty RSS summary are scored against the fetched article text instead
 * of an empty string.
 */
function classifyItemLevelCategories(input: {
  feed: { url: string; link: string | null; sourceKind: string | null };
  parsed: { metadata: FeedMetadata };
  mixedFeed: boolean;
  items: ParsedFeedItem[];
}): ParsedFeedItem[] {
  return input.items.map((item) => {
    if (canonicalizeCategoryLabels(item.categoryLabels).length > 0 || !input.mixedFeed) {
      return { ...item, inferredCategoryLabels: [] };
    }
    const itemClassification = classifyFeedItemCategories({
      feedTitle: input.parsed.metadata.title,
      feedDescription: input.parsed.metadata.description,
      feedUrl: input.parsed.metadata.canonicalUrl || input.feed.url,
      feedSiteUrl: input.parsed.metadata.link ?? input.feed.link,
      sourceKind: input.feed.sourceKind,
      itemTitle: item.title,
      itemSummary: item.summary ?? item.contentText,
      itemUrl: item.link,
    });
    return { ...item, inferredCategoryLabels: itemClassification.categories };
  });
}

async function tryResolveFaviconMetadata(
  database: FeedIngestDatabase,
  seedUrl: string,
  embeddedIconUrl?: string | null,
): Promise<{
  url: string;
  source: string;
} | null> {
  const faviconStore = createDrizzleFaviconHostStore(database);
  try {
    const websiteIcon = await resolvePersistedFeedFaviconUrl(faviconStore, seedUrl);
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
    hostRateLimiter?: HostRateLimiter;
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
        title: feeds.title,
        description: feeds.description,
        sourceKind: feeds.sourceKind,
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

    const fetched = options?.hostRateLimiter
      ? await options.hostRateLimiter.run(feed.url, () =>
          fetchFeedDocument(feed.url, feed.etag, feed.lastModified),
        )
      : await fetchFeedDocument(feed.url, feed.etag, feed.lastModified);
    if (!fetched.ok) {
      const now = new Date();
      const permanent = isPermanentHttpStatus(fetched.httpStatus);
      const backoffMs = computeFailureBackoffMs(
        {
          lastRefreshSucceededAt: feed.lastRefreshSucceededAt,
          lastRefreshFailedAt: feed.lastRefreshFailedAt,
        },
        permanent,
      );
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
      return {
        ok: false,
        itemCount: 0,
        error: `Feed fetch failed: ${fetched.error}`,
        permanent,
      };
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
        const resolved = await tryResolveFaviconMetadata(database, seed);
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

      // A 304 means the document wasn't fetched, so there's no parsed content to classify
      // items against. Still run feed-level classification off stored metadata so a feed
      // that has never had a successful full-content refresh doesn't stay uncategorized
      // indefinitely — but only when the feed has no explicit categories yet, mirroring the
      // canonical-label check the full-fetch path runs against freshly parsed metadata.
      // Skipping this otherwise avoids re-running the classifier and rewriting
      // `provenance = "classifier"` rows on every poll of an unchanged, already-categorized feed.
      if (!(await hasExplicitFeedCategories(database, feed.id))) {
        const feedCategories = classifyFeedCategories({
          feedTitle: feed.title,
          feedDescription: feed.description,
          feedUrl: feed.url,
          feedSiteUrl: feed.link,
          sourceKind: feed.sourceKind,
        }).categories;
        await syncInferredFeedCategories(database, { feedId: feed.id, feedCategories, items: [] }, now);
      }

      return { ok: true, itemCount: 0, notModified: true };
    }

    const parsed = parseFeedDocument(fetched.body, feed.id, fetched.finalUrl);
    const now = new Date();
    const deduped = new Map<string, ParsedFeedItem>();
    for (const item of parsed.items) {
      // Ingestion owns canonical URL generation and in-memory dedupe before DB upsert.
      deduped.set(item.canonicalUrl, item);
    }
    const feedForClassification = { url: feed.url, link: feed.link, sourceKind: feed.sourceKind };
    const feedCategories = classifyFeedLevelCategories({
      feed: feedForClassification,
      parsed: { metadata: parsed.metadata, items: [] },
    });
    const mixedFeed = isMixedFeed({
      feed: feedForClassification,
      parsed: { metadata: parsed.metadata, items: [] },
    });
    let items = Array.from(deduped.values());
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
    // Item-level classification runs after enrichment so items with a thin/empty RSS summary
    // are scored against the fetched article text instead of an empty string.
    items = classifyItemLevelCategories({
      feed: feedForClassification,
      parsed: { metadata: parsed.metadata },
      mixedFeed,
      items,
    });

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
      const resolved = await tryResolveFaviconMetadata(database, seed, parsed.metadata.iconUrl);
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

      if (items.length > 0) {
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
      }

      await syncParsedFeedCategories(
        tx,
        {
          feedId: feed.id,
          feedLabels: parsed.metadata.categoryLabels,
          items,
        },
        now,
      );

      await syncInferredFeedCategories(
        tx,
        {
          feedId: feed.id,
          feedCategories,
          items,
        },
        now,
      );
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
