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
  MAX_CLASSIFIER_LABELS,
  shouldSuppressClassifierFeedFallback,
  type InferredCategoryLabel,
} from "./classifier";
import { discoverFeedUrlFromHtml } from "./discover-url";
import {
  classifyFeedCategoriesByEmbedding,
  classifyFeedItemCategoriesByEmbedding,
  type EmbeddingClassifierConfig,
} from "./embeddings";
import { fetchArticleEnrichment } from "./enrich";
import { fetchFeedDocument } from "./fetch";
import { parseFeedDocument } from "./parse";
import { syncFeedToSearch } from "./search";
import {
  hasExplicitFeedCategories,
  syncInferredFeedCategories,
  syncParsedFeedCategories,
  type ClassifierModelInfo,
} from "./categories";
import { syncParsedFeedItemTags } from "./tags";
import {
  CLASSIFIER_TAXONOMY_VERSION,
  EMBEDDING_CLASSIFIER_METHOD,
  EMBEDDING_CLASSIFIER_MODEL_ID,
  KEYWORD_CLASSIFIER_METHOD,
  KEYWORD_CLASSIFIER_MODEL_ID,
} from "./taxonomy";
import { summarizeText } from "../../lib/feed-text";
import type {
  FeedIngestDatabase,
  FeedMetadata,
  FetchFeedDocumentResult,
  FeedRefreshResult,
  HostRateLimiter,
  HtmlFeedFailureClass,
  ParsedFeedDocument,
  ParsedFeedItem,
  SearchSyncConfig,
} from "./types";

const MAX_ENRICHMENTS_PER_REFRESH = 5;
const ENRICHMENT_CONCURRENCY = 3;
const PERMANENT_FAILURE_BACKOFF_MS = 24 * 60 * 60 * 1000;
const HTML_PARSE_ERROR = "Unsupported feed format: received HTML document";
const SCHEDULED_HTML_AUTODISCOVERY_PROVENANCE = "scheduled_html_autodiscovery";
const CERTIFICATE_FETCH_ERROR_PATTERN =
  /certificate|ERR_TLS_CERT|UNABLE_TO_GET_ISSUER_CERT|UNABLE_TO_VERIFY_LEAF_SIGNATURE|SELF_SIGNED_CERT|CERT_HAS_EXPIRED/i;

type FetchedFeedDocument = Extract<FetchFeedDocumentResult, { ok: true; notModified: false }>;

type ResolvedRefreshDocument =
  | {
      ok: true;
      fetched: FetchedFeedDocument;
      parsed: ParsedFeedDocument;
      discoveredFromUrl: string | null;
      discoveryProvenance: string | null;
    }
  | {
      ok: false;
      error: string;
      failureClass: HtmlFeedFailureClass;
    };

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

function isPermanentFetchError(error: string | undefined): boolean {
  return Boolean(error && CERTIFICATE_FETCH_ERROR_PATTERN.test(error));
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

function contentTypeIsHtml(contentType: string): boolean {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase();
  return normalized === "text/html" || normalized === "application/xhtml+xml";
}

function bodyLooksLikeHtmlDocument(body: string): boolean {
  const lower = body.trimStart().slice(0, 2048).toLowerCase();
  return (
    lower.startsWith("<!doctype html") ||
    lower.startsWith("<html") ||
    lower.includes("<head") ||
    lower.includes("<body")
  );
}

function fetchedDocumentIsHtml(fetched: FetchedFeedDocument): boolean {
  if (bodyLooksLikeHtmlDocument(fetched.body)) {
    return true;
  }
  if (!contentTypeIsHtml(fetched.contentType)) {
    return false;
  }
  const lower = fetched.body.trimStart().slice(0, 256).toLowerCase();
  return !(
    lower.startsWith("<?xml") ||
    lower.startsWith("<rss") ||
    lower.startsWith("<feed") ||
    lower.startsWith("{")
  );
}

function isHtmlParseError(error: unknown): boolean {
  return error instanceof Error && error.message === HTML_PARSE_ERROR;
}

function endpointLooksStale(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\/(feed|feeds|rss|atom)\/?$/.test(path) || /\.(rss|atom|xml|json)$/.test(path);
  } catch {
    return false;
  }
}

function classifyHtmlFeedFailure(body: string, url: string): HtmlFeedFailureClass {
  const text = body.slice(0, 65536).toLowerCase();

  if (/captcha|turnstile|cf-challenge|cloudflare|checking your browser|are you human/.test(text)) {
    return "captcha_html";
  }

  if (
    /access denied|forbidden|not authorized|permission denied|request blocked|blocked/.test(text)
  ) {
    return "access_denied_html";
  }

  if (/log in|login|sign in|signin|authentication required|please authenticate/.test(text)) {
    return "login_html";
  }

  if (
    /not found|404|feed no longer|feed moved|endpoint no longer/.test(text) ||
    endpointLooksStale(url)
  ) {
    return "stale_endpoint_html";
  }

  return "html_not_feed";
}

function htmlFeedFailure(
  failureClass: HtmlFeedFailureClass,
  reason: string,
): ResolvedRefreshDocument {
  return {
    ok: false,
    failureClass,
    error: `Feed returned HTML (${failureClass}): ${reason}`,
  };
}

async function markHtmlFeedRefreshFailed(
  database: FeedIngestDatabase,
  feedId: string,
  error: string,
  failureClass: HtmlFeedFailureClass,
): Promise<FeedRefreshResult> {
  const now = new Date();
  await database
    .update(feeds)
    .set({
      refreshStatus: "failed",
      lastRefreshFailedAt: now,
      lastRefreshError: error,
      lastRefreshCompletedAt: now,
      nextRefreshAt: new Date(now.getTime() + PERMANENT_FAILURE_BACKOFF_MS),
    })
    .where(eq(feeds.id, feedId));

  return {
    ok: false,
    itemCount: 0,
    error,
    failureClass,
    permanent: true,
  };
}

async function fetchRefreshDocument(
  url: string,
  etag: string | null,
  lastModified: string | null,
  options?: { hostRateLimiter?: HostRateLimiter },
): Promise<FetchFeedDocumentResult> {
  if (options?.hostRateLimiter) {
    return await options.hostRateLimiter.run(url, () => fetchFeedDocument(url, etag, lastModified));
  }
  return await fetchFeedDocument(url, etag, lastModified);
}

async function resolveHtmlRefreshDocument(input: {
  feedId: string;
  fetched: FetchedFeedDocument;
  fetchDocument: (
    url: string,
    etag: string | null,
    lastModified: string | null,
  ) => Promise<FetchFeedDocumentResult>;
}): Promise<ResolvedRefreshDocument> {
  const initialFailureClass = classifyHtmlFeedFailure(input.fetched.body, input.fetched.finalUrl);
  const discoveredUrl = discoverFeedUrlFromHtml(input.fetched.body, input.fetched.finalUrl);
  if (!discoveredUrl) {
    return htmlFeedFailure(initialFailureClass, "no feed alternate found");
  }

  const discoveredFetched = await input.fetchDocument(discoveredUrl, null, null);
  if (!discoveredFetched.ok) {
    return htmlFeedFailure(
      initialFailureClass,
      `discovered alternate fetch failed: ${discoveredFetched.error}`,
    );
  }

  if (discoveredFetched.notModified) {
    return htmlFeedFailure(initialFailureClass, "discovered alternate returned 304 Not Modified");
  }

  try {
    return {
      ok: true,
      fetched: discoveredFetched,
      parsed: parseFeedDocument(discoveredFetched.body, input.feedId, discoveredFetched.finalUrl),
      discoveredFromUrl: input.fetched.finalUrl,
      discoveryProvenance: SCHEDULED_HTML_AUTODISCOVERY_PROVENANCE,
    };
  } catch (error) {
    const failureClass =
      isHtmlParseError(error) || fetchedDocumentIsHtml(discoveredFetched)
        ? classifyHtmlFeedFailure(discoveredFetched.body, discoveredFetched.finalUrl)
        : initialFailureClass;
    return htmlFeedFailure(failureClass, "discovered alternate was not a supported feed");
  }
}

async function resolveRefreshDocument(input: {
  feedId: string;
  fetched: FetchedFeedDocument;
  fetchDocument: (
    url: string,
    etag: string | null,
    lastModified: string | null,
  ) => Promise<FetchFeedDocumentResult>;
}): Promise<ResolvedRefreshDocument> {
  if (fetchedDocumentIsHtml(input.fetched)) {
    return await resolveHtmlRefreshDocument(input);
  }

  try {
    return {
      ok: true,
      fetched: input.fetched,
      parsed: parseFeedDocument(input.fetched.body, input.feedId, input.fetched.finalUrl),
      discoveredFromUrl: null,
      discoveryProvenance: null,
    };
  } catch (error) {
    if (!isHtmlParseError(error)) {
      throw error;
    }
    return await resolveHtmlRefreshDocument(input);
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

/**
 * Classifies feed-level categories when the parsed document's RSS/Atom/JSON Feed category
 * tags don't map to any canonical category. Feed-level classification does not depend on
 * item content, so it can run before article enrichment.
 */
function classifyFeedLevelCategories(input: {
  feed: { url: string; link: string | null; sourceKind: string | null };
  parsed: ParsedFeedDocument;
}): { categories: InferredCategoryLabel[]; suppressedFallback: boolean } {
  if (canonicalizeCategoryLabels(input.parsed.metadata.categoryLabels).length > 0) {
    return { categories: [], suppressedFallback: false };
  }
  const classificationInput = {
    feedTitle: input.parsed.metadata.title,
    feedDescription: input.parsed.metadata.description,
    feedUrl: input.parsed.metadata.canonicalUrl || input.feed.url,
    feedSiteUrl: input.parsed.metadata.link ?? input.feed.link,
    sourceKind: input.feed.sourceKind,
  };
  if (shouldSuppressClassifierFeedFallback(classificationInput)) {
    return { categories: [], suppressedFallback: true };
  }
  return {
    categories: classifyFeedCategories(classificationInput).categories,
    suppressedFallback: false,
  };
}

/**
 * Classifies item-level categories for every item after enrichment. Explicit source
 * categories still win at read time; classifier labels only fill remaining chip slots.
 * Must run after article enrichment so items with a thin/empty RSS summary are scored
 * against the fetched article text instead of an empty string.
 */
function classifyItemLevelCategories(input: {
  feed: { url: string; link: string | null; sourceKind: string | null };
  parsed: { metadata: FeedMetadata };
  items: ParsedFeedItem[];
}): ParsedFeedItem[] {
  return input.items.map((item) => {
    const explicitLabels = canonicalizeCategoryLabels(item.categoryLabels);
    const remainingChipSlots = Math.max(0, MAX_CLASSIFIER_LABELS - explicitLabels.length);
    if (remainingChipSlots === 0) {
      return { ...item, inferredCategoryLabels: [] };
    }

    // Request enough candidates to survive filtering out labels the explicit source
    // already claimed: classifyFeedItemCategories() truncates internally, so asking for
    // only remainingChipSlots risks losing a higher-scored category to truncation before
    // this filter ever runs, when a lower-scored duplicate of an explicit label took its
    // place in the top-N.
    const itemClassification = classifyFeedItemCategories(
      {
        feedTitle: input.parsed.metadata.title,
        feedDescription: input.parsed.metadata.description,
        feedUrl: input.parsed.metadata.canonicalUrl || input.feed.url,
        feedSiteUrl: input.parsed.metadata.link ?? input.feed.link,
        sourceKind: input.feed.sourceKind,
        itemTitle: item.title,
        itemSummary: item.summary,
        itemContentText: item.contentText,
        itemUrl: item.link,
      },
      remainingChipSlots + explicitLabels.length,
    );

    const inferredCategoryLabels = itemClassification.categories
      .filter((category) => !explicitLabels.includes(category.label))
      .slice(0, remainingChipSlots);

    return { ...item, inferredCategoryLabels };
  });
}

const KEYWORD_CLASSIFIER_MODEL: ClassifierModelInfo = {
  modelId: KEYWORD_CLASSIFIER_MODEL_ID,
  taxonomyVersion: CLASSIFIER_TAXONOMY_VERSION,
  classifierMethod: KEYWORD_CLASSIFIER_METHOD,
};

function embeddingClassifierModel(config: EmbeddingClassifierConfig): ClassifierModelInfo {
  return {
    modelId: config.model ?? EMBEDDING_CLASSIFIER_MODEL_ID,
    taxonomyVersion: CLASSIFIER_TAXONOMY_VERSION,
    classifierMethod: EMBEDDING_CLASSIFIER_METHOD,
  };
}

/**
 * Best-effort embedding-classifier pass, run in parallel with (never instead of) the keyword
 * classifier so both write independent rows for direct comparison. Failures here (network,
 * rate limit, bad API key) never fail the refresh — embedding classification is a comparison
 * signal layered on top of the keyword classifier's baseline, not a hard dependency. Returns
 * `null` when no config was provided (embedding classification is opt-in) or the call failed.
 */
async function classifyFeedCategoriesByEmbeddingSafely(
  classificationInput: Parameters<typeof classifyFeedCategoriesByEmbedding>[0],
  config: EmbeddingClassifierConfig | undefined,
): Promise<InferredCategoryLabel[] | null> {
  if (!config) {
    return null;
  }
  if (shouldSuppressClassifierFeedFallback(classificationInput)) {
    return null;
  }
  try {
    const result = await classifyFeedCategoriesByEmbedding(classificationInput, config);
    return result.categories;
  } catch {
    return null;
  }
}

async function classifyFeedLevelCategoriesByEmbeddingSafely(
  input: {
    feed: { url: string; link: string | null; sourceKind: string | null };
    parsed: ParsedFeedDocument;
  },
  config: EmbeddingClassifierConfig | undefined,
): Promise<InferredCategoryLabel[] | null> {
  if (!config) {
    return null;
  }
  if (canonicalizeCategoryLabels(input.parsed.metadata.categoryLabels).length > 0) {
    return null;
  }
  return classifyFeedCategoriesByEmbeddingSafely(
    {
      feedTitle: input.parsed.metadata.title,
      feedDescription: input.parsed.metadata.description,
      feedUrl: input.parsed.metadata.canonicalUrl || input.feed.url,
      feedSiteUrl: input.parsed.metadata.link ?? input.feed.link,
      sourceKind: input.feed.sourceKind,
    },
    config,
  );
}

async function classifyItemLevelCategoriesByEmbeddingSafely(
  input: {
    feed: { url: string; link: string | null; sourceKind: string | null };
    parsed: { metadata: FeedMetadata };
    items: ParsedFeedItem[];
  },
  config: EmbeddingClassifierConfig | undefined,
): Promise<Map<string, InferredCategoryLabel[]> | null> {
  if (!config) {
    return null;
  }
  const results = new Map<string, InferredCategoryLabel[]>();
  await Promise.all(
    input.items.map(async (item) => {
      const explicitLabels = canonicalizeCategoryLabels(item.categoryLabels);
      const remainingChipSlots = Math.max(0, MAX_CLASSIFIER_LABELS - explicitLabels.length);
      if (remainingChipSlots === 0) {
        results.set(item.id, []);
        return;
      }
      try {
        const classification = await classifyFeedItemCategoriesByEmbedding(
          {
            feedTitle: input.parsed.metadata.title,
            feedDescription: input.parsed.metadata.description,
            feedUrl: input.parsed.metadata.canonicalUrl || input.feed.url,
            feedSiteUrl: input.parsed.metadata.link ?? input.feed.link,
            sourceKind: input.feed.sourceKind,
            itemTitle: item.title,
            itemSummary: item.summary,
            itemContentText: item.contentText,
            itemUrl: item.link,
          },
          config,
          remainingChipSlots + explicitLabels.length,
        );
        results.set(
          item.id,
          classification.categories
            .filter((category) => !explicitLabels.includes(category.label))
            .slice(0, remainingChipSlots),
        );
      } catch {
        // One item's embedding call failing (rate limit, transient network error) does not
        // block the rest of the batch or the keyword classifier's already-computed labels.
      }
    }),
  );
  return results;
}

function summarizeItemCategoryStats(items: ParsedFeedItem[]): {
  itemClassifierLabels: number;
  itemClassifierAbstentions: number;
} {
  return items.reduce(
    (stats, item) => {
      const inferredLabelCount = item.inferredCategoryLabels?.length ?? 0;
      stats.itemClassifierLabels += inferredLabelCount;
      if (
        canonicalizeCategoryLabels(item.categoryLabels).length === 0 &&
        inferredLabelCount === 0
      ) {
        stats.itemClassifierAbstentions += 1;
      }
      return stats;
    },
    { itemClassifierLabels: 0, itemClassifierAbstentions: 0 },
  );
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
    embeddingClassifier?: EmbeddingClassifierConfig;
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
        submittedUrl: feeds.submittedUrl,
        siteUrl: feeds.siteUrl,
        canonicalFeedUrl: feeds.canonicalFeedUrl,
        discoveredFromUrl: feeds.discoveredFromUrl,
        discoveryProvenance: feeds.discoveryProvenance,
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

    const fetchDocument = (
      url: string,
      etag: string | null,
      lastModified: string | null,
    ): Promise<FetchFeedDocumentResult> =>
      fetchRefreshDocument(url, etag, lastModified, {
        hostRateLimiter: options?.hostRateLimiter,
      });

    const fetched = await fetchDocument(feed.url, feed.etag, feed.lastModified);
    if (!fetched.ok) {
      const now = new Date();
      const permanent =
        isPermanentHttpStatus(fetched.httpStatus) || isPermanentFetchError(fetched.error);
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
          submittedUrl: feed.submittedUrl ?? feed.url,
          siteUrl: feed.siteUrl ?? feed.link,
          canonicalFeedUrl: feed.canonicalFeedUrl ?? feed.url,
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
        const classificationInput = {
          feedTitle: feed.title,
          feedDescription: feed.description,
          feedUrl: feed.url,
          feedSiteUrl: feed.link,
          sourceKind: feed.sourceKind,
        };
        const suppressedFeedClassifierFallback =
          shouldSuppressClassifierFeedFallback(classificationInput);
        const feedCategories = suppressedFeedClassifierFallback
          ? []
          : classifyFeedCategories(classificationInput).categories;
        await syncInferredFeedCategories(
          database,
          { feedId: feed.id, feedCategories, items: [], model: KEYWORD_CLASSIFIER_MODEL },
          now,
        );
        const embeddingConfig = options?.embeddingClassifier;
        const embeddingFeedCategories = await classifyFeedCategoriesByEmbeddingSafely(
          classificationInput,
          embeddingConfig,
        );
        if (embeddingConfig && embeddingFeedCategories) {
          await syncInferredFeedCategories(
            database,
            {
              feedId: feed.id,
              feedCategories: embeddingFeedCategories,
              items: [],
              model: embeddingClassifierModel(embeddingConfig),
            },
            now,
          );
        }
        return {
          ok: true,
          itemCount: 0,
          notModified: true,
          categoryStats: {
            feedClassifierLabels: feedCategories.length,
            itemClassifierLabels: 0,
            itemClassifierAbstentions: 0,
            suppressedFeedClassifierFallback,
          },
        };
      }

      return {
        ok: true,
        itemCount: 0,
        notModified: true,
        categoryStats: {
          feedClassifierLabels: 0,
          itemClassifierLabels: 0,
          itemClassifierAbstentions: 0,
          suppressedFeedClassifierFallback: false,
        },
      };
    }

    const resolved = await resolveRefreshDocument({
      feedId: feed.id,
      fetched,
      fetchDocument,
    });
    if (!resolved.ok) {
      return await markHtmlFeedRefreshFailed(
        database,
        feed.id,
        resolved.error,
        resolved.failureClass,
      );
    }

    const parsed = resolved.parsed;
    const fetchedForParse = resolved.fetched;
    const now = new Date();
    const deduped = new Map<string, ParsedFeedItem>();
    for (const item of parsed.items) {
      // Ingestion owns canonical URL generation and in-memory dedupe before DB upsert.
      deduped.set(item.canonicalUrl, item);
    }
    const feedForClassification = { url: feed.url, link: feed.link, sourceKind: feed.sourceKind };
    const feedClassification = classifyFeedLevelCategories({
      feed: feedForClassification,
      parsed: { metadata: parsed.metadata, items: [] },
    });
    const feedCategories = feedClassification.categories;
    const embeddingConfig = options?.embeddingClassifier;
    const embeddingFeedCategoriesPromise = classifyFeedLevelCategoriesByEmbeddingSafely(
      { feed: feedForClassification, parsed },
      embeddingConfig,
    );
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
      items,
    });
    const itemCategoryStats = summarizeItemCategoryStats(items);

    // Embedding classification runs after enrichment for the same reason as the keyword
    // pass above, and after the feed-level embedding promise was already fired in parallel
    // with enrichment (both are network calls; running them concurrently instead of
    // sequentially keeps embedding classification from adding its own latency on top of
    // enrichment's, rather than after it).
    const embeddingFeedCategories = await embeddingFeedCategoriesPromise;
    const embeddingItemCategoriesById = await classifyItemLevelCategoriesByEmbeddingSafely(
      { feed: feedForClassification, parsed: { metadata: parsed.metadata }, items },
      embeddingConfig,
    );

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

    let sourceTagAssignments = 0;
    await database.transaction(async (tx) => {
      await tx
        .update(feeds)
        .set({
          url: parsed.metadata.canonicalUrl,
          title: parsed.metadata.title,
          description: parsed.metadata.description,
          link: parsed.metadata.link,
          submittedUrl: feed.submittedUrl ?? feed.url,
          siteUrl: parsed.metadata.link,
          canonicalFeedUrl: parsed.metadata.canonicalUrl,
          discoveredFromUrl: resolved.discoveredFromUrl ?? feed.discoveredFromUrl,
          discoveryProvenance:
            resolved.discoveryProvenance ?? feed.discoveryProvenance ?? "direct_feed_refresh",
          updatedAt: now,
          refreshStatus: "idle",
          lastRefreshCompletedAt: now,
          lastRefreshSucceededAt: now,
          lastRefreshError: null,
          etag: fetchedForParse.etag,
          lastModified: fetchedForParse.lastModified,
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

      sourceTagAssignments = await syncParsedFeedItemTags(tx, items, now);

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
          model: KEYWORD_CLASSIFIER_MODEL,
        },
        now,
      );

      // `embeddingItemCategoriesById` is a Map even when every item's embed call failed
      // (each item's own try/catch just skips setting its entry rather than making the
      // whole call return null) — an empty Map is still truthy, so checking its presence
      // alone would run the sync and wipe out previously-good embedding rows during a total
      // Voyage outage. Only include items that actually got a result, and skip the item sync
      // entirely (passing `items: []`) when nothing succeeded so existing rows are left alone.
      const embeddingItemAssignments = embeddingItemCategoriesById
        ? items.flatMap((item) => {
            const inferredCategoryLabels = embeddingItemCategoriesById.get(item.id);
            return inferredCategoryLabels === undefined
              ? []
              : [{ id: item.id, inferredCategoryLabels }];
          })
        : [];
      if (embeddingConfig && (embeddingFeedCategories || embeddingItemAssignments.length > 0)) {
        await syncInferredFeedCategories(
          tx,
          {
            feedId: feed.id,
            feedCategories: embeddingFeedCategories ?? [],
            items: embeddingItemAssignments,
            model: embeddingClassifierModel(embeddingConfig),
          },
          now,
        );
      }
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
      categoryStats: {
        feedClassifierLabels: feedCategories.length,
        itemClassifierLabels: itemCategoryStats.itemClassifierLabels,
        itemClassifierAbstentions: itemCategoryStats.itemClassifierAbstentions,
        suppressedFeedClassifierFallback: feedClassification.suppressedFallback,
        sourceTagAssignments,
      },
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
