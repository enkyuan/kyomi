import { attachItemDocuments } from "./documents";
import { and, eq, or, sql } from "drizzle-orm";
import { canonicalizeCategoryLabels, feedItems, feeds } from "@kyomi/db";
import {
  createDrizzleFaviconHostStore,
  faviconSourceRank,
  resolvePersistedFeedFaviconUrl,
  tryFetchImageIfHostSafe,
} from "../favicon";
import {
  classifyFeedCategories,
  classifyItemCategories,
  MAX_CLASSIFIER_LABELS,
  shouldSuppressFallback,
  type InferredCategoryLabel,
} from "./classifier";
import { discoverFeedUrlFromHtml } from "./discover-url";
import {
  classifyFeedEmbedding,
  classifyItemEmbeddings,
  embeddingModelInfo,
  type EmbeddingClassifierConfig,
} from "./embeddings";
import { fetchFeedDocument } from "./fetch";
import { normalizeFeedUrl, parseFeedDocument } from "./parse";
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
  KEYWORD_CLASSIFIER_METHOD,
  KEYWORD_CLASSIFIER_MODEL_ID,
} from "./taxonomy";
import type {
  FeedFetchFailureClass,
  FeedIngestDatabase,
  FeedMetadata,
  FetchFeedDocumentResult,
  FeedRefreshCategoryStats,
  FeedRefreshResult,
  HostRateLimiter,
  HtmlFeedFailureClass,
  ParsedFeedDocument,
  ParsedFeedItem,
  SearchSyncConfig,
} from "./types";

const MAX_EXTRACTION_PREFETCH_PER_REFRESH = 5;
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

function fetchFailureClass(status: number | undefined, permanent: boolean): FeedFetchFailureClass {
  if (status === 429) return "http_429";
  if (status === 404) return "http_404";
  if (status !== undefined && status >= 500) return "http_5xx";
  if (status !== undefined && status >= 400) return "http_4xx";
  // The only status-less failure treated as permanent is a certificate error.
  return permanent ? "certificate" : "network";
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

function isFeedsUrlUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  // Drizzle wraps a node-postgres constraint violation in DrizzleQueryError.
  const databaseError = (error instanceof Error && error.cause ? error.cause : error) as {
    code?: unknown;
    constraint?: unknown;
  };
  return databaseError.code === "23505" && databaseError.constraint === "feeds_url_unique";
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
  generation: number,
  error: string,
  failureClass: HtmlFeedFailureClass,
): Promise<FeedRefreshResult> {
  const now = new Date();
  const [updated] = await database
    .update(feeds)
    .set({
      refreshStatus: "failed",
      lastRefreshFailedAt: now,
      lastRefreshError: error,
      lastRefreshCompletedAt: now,
      nextRefreshAt: new Date(now.getTime() + PERMANENT_FAILURE_BACKOFF_MS),
    })
    .where(and(eq(feeds.id, feedId), eq(feeds.refreshGeneration, generation)))
    .returning({ id: feeds.id });
  if (!updated) {
    logFeedRefreshSuperseded(feedId, generation, "failed");
    return skippedSupersededFeedRefresh();
  }

  return {
    ok: false,
    itemCount: 0,
    error,
    failureClass,
    permanent: true,
  };
}

async function claimFeedRefresh(
  database: FeedIngestDatabase,
  feedId: string,
  expectedGeneration: number | undefined,
): Promise<{ generation: number } | null> {
  const now = new Date();
  const predicate =
    expectedGeneration === undefined
      ? and(eq(feeds.id, feedId), eq(feeds.refreshStatus, "queued"))
      : and(
          eq(feeds.id, feedId),
          eq(feeds.refreshGeneration, expectedGeneration),
          // Redis retries retain their original generation. A transient failure marks that
          // generation failed before rethrowing, so its reclaimed message must be able to
          // move it back to running. New manual/scheduled work increments the generation,
          // making an older message fail this claim instead.
          or(eq(feeds.refreshStatus, "queued"), eq(feeds.refreshStatus, "failed")),
        );
  const [claimed] = await database
    .update(feeds)
    .set({
      refreshStatus: "running",
      lastRefreshStartedAt: now,
      lastRefreshError: null,
      updatedAt: now,
    })
    .where(predicate)
    .returning({ generation: feeds.refreshGeneration });
  return claimed ?? null;
}

function logFeedRefreshSuperseded(feedId: string, generation: number, state: "failed" | "idle") {
  console.info("feed.refresh.superseded", { feedId, generation, state });
}

function skippedSupersededFeedRefresh(): FeedRefreshResult {
  return { ok: true, itemCount: 0, skipped: "superseded" };
}

function urlCarriesLogin(url: string): boolean {
  try {
    const { username, password } = new URL(url);
    return Boolean(username || password);
  } catch {
    return false;
  }
}

/**
 * The URL a document was served from becomes the feed's stored URL (and its provenance), and that
 * row is readable by every account. A redirect or an autodiscovered link can add a username or
 * password to it, so such a document is not accepted; fetching follows redirects as before.
 */
function refuseLoginUrl(result: FetchFeedDocumentResult): FetchFeedDocumentResult {
  if (result.ok && !result.notModified && urlCarriesLogin(result.finalUrl)) {
    return { ok: false, error: "Feed URLs with a username or password are not supported" };
  }
  return result;
}

async function fetchRefreshDocument(
  url: string,
  etag: string | null,
  lastModified: string | null,
  options?: { hostRateLimiter?: HostRateLimiter },
): Promise<FetchFeedDocumentResult> {
  if (options?.hostRateLimiter) {
    return refuseLoginUrl(
      await options.hostRateLimiter.run(url, () => fetchFeedDocument(url, etag, lastModified)),
    );
  }
  return refuseLoginUrl(await fetchFeedDocument(url, etag, lastModified));
}

async function resolveHtmlRefreshDocument(input: {
  window?: Parameters<typeof parseFeedDocument>[3];
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
      parsed: parseFeedDocument(
        discoveredFetched.body,
        input.feedId,
        discoveredFetched.finalUrl,
        input.window,
      ),
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

/** An old category, comments or author feed must never silently become a site's main feed.
 * Only recover a conventional endpoint under the catalogued homepage when the new feed
 * independently declares that same homepage and publication title. */
async function recoverGoneCatalogFeed(
  feed: { id: string; url: string; link: string | null; title: string },
  fetchDocument: Parameters<typeof resolveHtmlRefreshDocument>[0]["fetchDocument"],
  window: NonNullable<Parameters<typeof parseFeedDocument>[3]>,
) {
  if (!feed.link || !URL.canParse(feed.link) || !URL.canParse(feed.url)) return null;
  const home = new URL(feed.link);
  const old = new URL(feed.url);
  const homePath = home.pathname.replace(/\/?$/, "/");
  if (
    home.origin !== old.origin ||
    home.username ||
    home.password ||
    home.search ||
    home.hash ||
    old.search ||
    old.hash ||
    !old.pathname.startsWith(homePath) ||
    !/^(?:feeds?\/)?(?:feed|rss|atom|index)(?:\.(?:xml|rss|atom))?\/?$/i.test(
      old.pathname.slice(homePath.length),
    )
  )
    return null;

  const page = await fetchDocument(home.href, null, null);
  if (
    !page.ok ||
    page.notModified ||
    page.finalUrl.replace(/\/$/, "") !== home.href.replace(/\/$/, "")
  )
    return null;
  const alternate = discoverFeedUrlFromHtml(page.body, page.finalUrl);
  if (!alternate || new URL(alternate).origin !== home.origin || alternate === old.href)
    return null;
  const fetched = await fetchDocument(alternate, null, null);
  if (!fetched.ok || fetched.notModified || new URL(fetched.finalUrl).origin !== home.origin)
    return null;
  try {
    const parsed = parseFeedDocument(fetched.body, feed.id, fetched.finalUrl, window);
    if (
      parsed.metadata.link?.replace(/\/$/, "") !== home.href.replace(/\/$/, "") ||
      !feed.title.trim() ||
      parsed.metadata.title.trim().toLowerCase() !== feed.title.trim().toLowerCase()
    )
      return null;
    return {
      ok: true as const,
      fetched,
      parsed,
      discoveredFromUrl: home.href,
      discoveryProvenance: "catalog_homepage_alternate",
    };
  } catch {
    return null;
  }
}

async function resolveRefreshDocument(input: {
  window?: Parameters<typeof parseFeedDocument>[3];
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
      parsed: parseFeedDocument(
        input.fetched.body,
        input.feedId,
        input.fetched.finalUrl,
        input.window,
      ),
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
function classifyFeedLevel(input: {
  feed: { url: string; link: string | null; sourceKind: string | null };
  parsed: { metadata: FeedMetadata };
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
  if (shouldSuppressFallback(classificationInput)) {
    return { categories: [], suppressedFallback: true };
  }
  return {
    categories: classifyFeedCategories(classificationInput).categories,
    suppressedFallback: false,
  };
}

/**
 * Classifies item-level categories from the feed's own text. Explicit source categories still
 * win at read time; classifier labels only fill remaining chip slots. Items whose feed text is
 * thin are re-classified from the source page once an article.extract job fetches it.
 */
function classifyItemLevel(input: {
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
    // already claimed: classifyItemCategories() truncates internally, so asking for
    // only remainingChipSlots risks losing a higher-scored category to truncation before
    // this filter ever runs, when a lower-scored duplicate of an explicit label took its
    // place in the top-N.
    const itemClassification = classifyItemCategories(
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

type EmbeddingRefreshStats = NonNullable<FeedRefreshCategoryStats["embeddingClassifier"]>;

function createEmbeddingStats(
  config: EmbeddingClassifierConfig | undefined,
): EmbeddingRefreshStats {
  return {
    configured: Boolean(config),
    feedClassifierLabels: 0,
    feedClassifierAbstentions: 0,
    feedClassifierFailures: 0,
    itemClassifierLabels: 0,
    itemClassifierAbstentions: 0,
    itemClassifierFailures: 0,
  };
}

/**
 * Best-effort embedding-classifier pass, run in parallel with (never instead of) the keyword
 * classifier so both write independent rows for direct comparison. Failures here (network,
 * rate limit, bad API key) never fail the refresh — embedding classification is a comparison
 * signal layered on top of the keyword classifier's baseline, not a hard dependency. Returns
 * `null` when no config was provided (embedding classification is opt-in) or the call failed.
 */
async function tryFeedEmbedding(
  classificationInput: Parameters<typeof classifyFeedEmbedding>[0],
  config: EmbeddingClassifierConfig | undefined,
  stats: EmbeddingRefreshStats,
): Promise<InferredCategoryLabel[] | null> {
  if (!config) {
    return null;
  }
  if (shouldSuppressFallback(classificationInput)) {
    stats.feedClassifierAbstentions += 1;
    return null;
  }
  try {
    const result = await classifyFeedEmbedding(classificationInput, config);
    stats.feedClassifierLabels += result.categories.length;
    if (result.categories.length === 0) {
      stats.feedClassifierAbstentions += 1;
    }
    return result.categories;
  } catch {
    stats.feedClassifierFailures += 1;
    return null;
  }
}

async function tryChannelEmbedding(
  input: {
    feed: { url: string; link: string | null; sourceKind: string | null };
    parsed: ParsedFeedDocument;
  },
  config: EmbeddingClassifierConfig | undefined,
  stats: EmbeddingRefreshStats,
): Promise<InferredCategoryLabel[] | null> {
  if (!config) {
    return null;
  }
  if (canonicalizeCategoryLabels(input.parsed.metadata.categoryLabels).length > 0) {
    return null;
  }
  return tryFeedEmbedding(
    {
      feedTitle: input.parsed.metadata.title,
      feedDescription: input.parsed.metadata.description,
      feedUrl: input.parsed.metadata.canonicalUrl || input.feed.url,
      feedSiteUrl: input.parsed.metadata.link ?? input.feed.link,
      sourceKind: input.feed.sourceKind,
    },
    config,
    stats,
  );
}

async function tryItemEmbedding(
  input: {
    feed: { url: string; link: string | null; sourceKind: string | null };
    parsed: { metadata: FeedMetadata };
    items: ParsedFeedItem[];
  },
  config: EmbeddingClassifierConfig | undefined,
  stats: EmbeddingRefreshStats,
): Promise<Map<string, InferredCategoryLabel[]> | null> {
  if (!config) {
    return null;
  }
  const results = new Map<string, InferredCategoryLabel[]>();
  const candidates: Array<{
    item: ParsedFeedItem;
    explicitLabels: string[];
    remainingChipSlots: number;
  }> = [];
  for (const item of input.items) {
    const explicitLabels = canonicalizeCategoryLabels(item.categoryLabels);
    const remainingChipSlots = Math.max(0, MAX_CLASSIFIER_LABELS - explicitLabels.length);
    if (remainingChipSlots === 0) {
      results.set(item.id, []);
      continue;
    }
    candidates.push({ item, explicitLabels, remainingChipSlots });
  }

  try {
    const classifications = await classifyItemEmbeddings(
      candidates.map(({ item, explicitLabels, remainingChipSlots }) => ({
        id: item.id,
        feedTitle: input.parsed.metadata.title,
        feedDescription: input.parsed.metadata.description,
        feedUrl: input.parsed.metadata.canonicalUrl || input.feed.url,
        feedSiteUrl: input.parsed.metadata.link ?? input.feed.link,
        sourceKind: input.feed.sourceKind,
        itemTitle: item.title,
        itemSummary: item.summary,
        itemContentText: item.contentText,
        itemUrl: item.link,
        maxLabels: remainingChipSlots + explicitLabels.length,
      })),
      config,
    );

    let failedItems = 0;
    for (const { item, explicitLabels, remainingChipSlots } of candidates) {
      const classification = classifications.get(item.id);
      if (!classification) {
        // Its embeddings request failed; leaving it out keeps the item's existing labels.
        failedItems += 1;
        continue;
      }
      const inferredCategoryLabels = classification.categories
        .filter((category) => !explicitLabels.includes(category.label))
        .slice(0, remainingChipSlots);
      stats.itemClassifierLabels += inferredCategoryLabels.length;
      if (inferredCategoryLabels.length === 0) {
        stats.itemClassifierAbstentions += 1;
      }
      results.set(item.id, inferredCategoryLabels);
    }
    if (failedItems > 0) {
      stats.itemClassifierFailures += failedItems;
      console.warn("[ingestion] item embedding classification failed for part of the batch", {
        feedUrl: input.feed.url,
        itemCount: candidates.length,
        failedItems,
      });
    }
  } catch (error) {
    stats.itemClassifierFailures += candidates.length;
    console.warn("[ingestion] item embedding batch classification failed", {
      feedUrl: input.feed.url,
      itemCount: candidates.length,
      error: error instanceof Error ? error.message : String(error),
    });
  }
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

function shouldPrefetchExtractedContent(item: ParsedFeedItem): boolean {
  return (
    item.contentStatus === "pending" ||
    item.contentStatus === "partial" ||
    item.contentSource === "link_only" ||
    !item.contentText ||
    item.contentText.length < 220
  );
}

function selectExtractionPrefetchCandidates(items: ParsedFeedItem[]): string[] {
  return items
    .filter(shouldPrefetchExtractedContent)
    .slice(0, MAX_EXTRACTION_PREFETCH_PER_REFRESH)
    .map((item) => item.id);
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

// PostgreSQL text cannot store NUL. Publisher and transport diagnostics may include raw bytes.
function feedFailureMessage(message: string): string {
  return message.includes("\0") ? "Feed refresh failed: binary diagnostic" : message.slice(0, 1024);
}

export async function runFeedRefresh(
  database: FeedIngestDatabase,
  feedId: string,
  searchSync?: SearchSyncConfig,
  options?: {
    hostRateLimiter?: HostRateLimiter;
    embeddingClassifier?: EmbeddingClassifierConfig;
    refreshGeneration?: number;
    refreshIntervalMs?: number;
    catalogRefreshIntervalMs?: number;
  },
): Promise<FeedRefreshResult> {
  const claimed = await claimFeedRefresh(database, feedId, options?.refreshGeneration);
  if (!claimed) {
    return {
      ok: true,
      itemCount: 0,
      skipped: options?.refreshGeneration === undefined ? "not_queued" : "superseded",
    };
  }

  const generation = claimed.generation;
  try {
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
        subscriberCount: feeds.subscriberCount,
        catalogPreview: feeds.catalogPreview,
        lastRefreshSucceededAt: feeds.lastRefreshSucceededAt,
        lastRefreshFailedAt: feeds.lastRefreshFailedAt,
      })
      .from(feeds)
      .where(eq(feeds.id, feedId))
      .limit(1);

    if (!feed) {
      // The row was deleted after the refresh was claimed; another attempt finds nothing either.
      return { ok: false, itemCount: 0, error: "Feed not found", permanent: true };
    }

    const fetchDocument = (
      url: string,
      etag: string | null,
      lastModified: string | null,
    ): Promise<FetchFeedDocumentResult> =>
      fetchRefreshDocument(url, etag, lastModified, {
        hostRateLimiter: options?.hostRateLimiter,
      });

    const preview = options?.catalogRefreshIntervalMs !== undefined && feed.subscriberCount === 0;
    const hydrate = !preview && feed.catalogPreview;
    const interval =
      (preview ? options?.catalogRefreshIntervalMs : options?.refreshIntervalMs) ?? 3_600_000;
    const nextPoll = (now: Date) =>
      sql`CASE WHEN ${preview} AND subscriber_count > 0 THEN NOW() ELSE ${new Date(now.getTime() + interval).toISOString()}::timestamptz AT TIME ZONE 'UTC' END`;
    const until = new Date();
    const window = preview
      ? { since: new Date(until.getTime() - 7 * 86_400_000), until, limit: 3 }
      : undefined;
    // The deduplication key trims trailing slashes. Poll the exact path the publisher
    // supplied or last served, retaining aliases whose canonical URL belongs to another row.
    const candidate =
      feed.canonicalFeedUrl ?? (feed.lastRefreshSucceededAt ? null : feed.submittedUrl);
    const requestUrl =
      candidate && URL.canParse(candidate) && normalizeFeedUrl(candidate) === feed.url
        ? candidate
        : feed.url;
    const conditional =
      !hydrate && (requestUrl === feed.url || requestUrl === feed.canonicalFeedUrl);
    const etag = conditional ? feed.etag : null;
    const lastModified = conditional ? feed.lastModified : null;
    const initial = await fetchDocument(requestUrl, etag, lastModified);
    const recovered =
      window &&
      !feed.lastRefreshSucceededAt &&
      !initial.ok &&
      (initial.httpStatus === 404 || initial.httpStatus === 410)
        ? await recoverGoneCatalogFeed(feed, fetchDocument, window)
        : null;
    const fetched = recovered?.fetched ?? initial;
    if (!fetched.ok) {
      const message = feedFailureMessage(fetched.error);
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
      const [updated] = await database
        .update(feeds)
        .set({
          refreshStatus: "failed",
          lastRefreshFailedAt: now,
          lastRefreshError: message,
          lastRefreshCompletedAt: now,
          nextRefreshAt: new Date(now.getTime() + Math.max(backoffMs, fetched.retryAfterMs ?? 0)),
        })
        .where(and(eq(feeds.id, feedId), eq(feeds.refreshGeneration, generation)))
        .returning({ id: feeds.id });
      if (!updated) {
        logFeedRefreshSuperseded(feedId, generation, "failed");
        return skippedSupersededFeedRefresh();
      }
      return {
        ok: false,
        itemCount: 0,
        error: `Feed fetch failed: ${message}`,
        retryScheduled: preview || fetched.httpStatus === 429 || Boolean(fetched.retryAfterMs),
        failureClass: fetchFailureClass(fetched.httpStatus, permanent),
        permanent,
      };
    }

    if (fetched.notModified && !etag && !lastModified) {
      throw new Error("Publisher returned 304 to an unconditional request");
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
        !preview &&
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
      // A 304 means the document wasn't fetched, so there's no parsed content to classify
      // items against. Still run feed-level classification off stored metadata so a feed
      // that has never had a successful full-content refresh doesn't stay uncategorized
      // indefinitely — but only when the feed has no explicit categories yet, mirroring the
      // canonical-label check the full-fetch path runs against freshly parsed metadata.
      // Skipping this otherwise avoids re-running the classifier and rewriting
      // `provenance = "classifier"` rows on every poll of an unchanged, already-categorized feed.
      const hasExplicitCategories = await hasExplicitFeedCategories(database, feed.id);
      const classificationInput = {
        feedTitle: feed.title,
        feedDescription: feed.description,
        feedUrl: feed.url,
        feedSiteUrl: feed.link,
        sourceKind: feed.sourceKind,
      };
      const suppressedFeedClassifierFallback =
        !hasExplicitCategories && shouldSuppressFallback(classificationInput);
      const feedCategories =
        hasExplicitCategories || suppressedFeedClassifierFallback
          ? []
          : classifyFeedCategories(classificationInput).categories;
      const embeddingConfig = options?.embeddingClassifier;
      const embeddingCategoryStats = createEmbeddingStats(embeddingConfig);
      const embeddingFeedCategories = hasExplicitCategories
        ? null
        : await tryFeedEmbedding(classificationInput, embeddingConfig, embeddingCategoryStats);
      let refreshSuperseded = false;

      // The terminal update locks this feed row until the classifier writes commit. That keeps
      // a newer generation from being queued between the fenced lifecycle update and category
      // mutations; if classification fails, both are rolled back before the failure path runs.
      await database.transaction(async (tx) => {
        const [updated] = await tx
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
            nextRefreshAt: nextPoll(now),
            ...(faviconPatch ?? {}),
          })
          .where(and(eq(feeds.id, feedId), eq(feeds.refreshGeneration, generation)))
          .returning({ id: feeds.id });
        if (!updated) {
          logFeedRefreshSuperseded(feedId, generation, "idle");
          refreshSuperseded = true;
          return;
        }

        if (hasExplicitCategories) {
          return;
        }

        await syncInferredFeedCategories(
          tx,
          { feedId: feed.id, feedCategories, items: [], model: KEYWORD_CLASSIFIER_MODEL },
          now,
        );
        if (embeddingConfig && embeddingFeedCategories) {
          await syncInferredFeedCategories(
            tx,
            {
              feedId: feed.id,
              feedCategories: embeddingFeedCategories,
              items: [],
              model: embeddingModelInfo(embeddingConfig),
            },
            now,
          );
        }
      });

      if (refreshSuperseded) {
        return skippedSupersededFeedRefresh();
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
          embeddingClassifier: embeddingCategoryStats,
        },
      };
    }

    const resolved =
      recovered ??
      (await resolveRefreshDocument({
        window,
        feedId: feed.id,
        fetched,
        fetchDocument,
      }));
    if (!resolved.ok) {
      return await markHtmlFeedRefreshFailed(
        database,
        feed.id,
        generation,
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
    const feedClassification = classifyFeedLevel({
      feed: feedForClassification,
      parsed: { metadata: parsed.metadata },
    });
    const feedCategories = feedClassification.categories;
    const embeddingConfig = options?.embeddingClassifier;
    const embeddingCategoryStats = createEmbeddingStats(embeddingConfig);
    let items = Array.from(deduped.values());
    const articleExtractionCandidateIds = preview ? [] : selectExtractionPrefetchCandidates(items);

    // Keep the refresh critical path CPU/local-DB only. Full source-page text now flows through
    // article.extract jobs after items are visible, so feed rows are not blocked on article fetches.
    items = classifyItemLevel({
      feed: feedForClassification,
      parsed: { metadata: parsed.metadata },
      items,
    });
    items = await attachItemDocuments(items);
    const itemCategoryStats = summarizeItemCategoryStats(items);

    const prevLink = feed.link ?? null;
    const nextLink = parsed.metadata.link ?? null;
    const linkChanged = (prevLink ?? "") !== (nextLink ?? "");
    const needsFavicon =
      !preview &&
      shouldResolveFavicon({
        currentUrl: feed.faviconUrl,
        currentSource: feed.faviconSource,
        linkChanged,
      });
    let faviconPatch: {
      faviconUrl: string;
      faviconSource: string;
      faviconFetchedAt: Date;
    } | null = null;

    let sourceTagAssignments = 0;
    let refreshSuperseded = false;
    await database.transaction(async (tx) => {
      const feedPatch = {
        title: parsed.metadata.title,
        description: parsed.metadata.description,
        link: parsed.metadata.link,
        submittedUrl: feed.submittedUrl ?? feed.url,
        siteUrl: parsed.metadata.link,
        canonicalFeedUrl: fetchedForParse.finalUrl.split("#", 1)[0]!,
        catalogPreview: preview,
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
        nextRefreshAt: nextPoll(now),
      };
      const persistFeed = (updateTx: typeof tx, patch: typeof feedPatch & { url?: string }) =>
        updateTx
          .update(feeds)
          .set(patch)
          .where(and(eq(feeds.id, feed.id), eq(feeds.refreshGeneration, generation)))
          .returning({ id: feeds.id });

      let updatedRows: Array<{ id: string }>;
      const shouldUpdateUrl =
        feed.url !== parsed.metadata.canonicalUrl &&
        feed.canonicalFeedUrl !== feedPatch.canonicalFeedUrl;
      if (shouldUpdateUrl) {
        try {
          updatedRows = await tx.transaction(
            async (savepoint) =>
              await persistFeed(savepoint, { ...feedPatch, url: parsed.metadata.canonicalUrl }),
          );
        } catch (error) {
          if (!isFeedsUrlUniqueViolation(error)) {
            throw error;
          }
          // Preserve this row's existing alias while committing the refreshed content and
          // canonical provenance. The savepoint keeps the outer ingestion transaction usable.
          updatedRows = await persistFeed(tx, feedPatch);
        }
      } else {
        updatedRows = await persistFeed(tx, feedPatch);
      }

      const [updated] = updatedRows;
      if (!updated) {
        logFeedRefreshSuperseded(feed.id, generation, "idle");
        refreshSuperseded = true;
        return;
      }

      if (items.length > 0) {
        // The conflict update below fills missing fields. For a verified publisher excerpt,
        // clear its coupled representations in the same transaction so no stale excerpt or
        // compiled document can outrank the recovered full text.
        const excerpts = items.flatMap((item) =>
          (item.excerptDigests ?? []).map(
            (digest) =>
              sql`(${item.canonicalUrl}::text, ${digest}::text, ${Buffer.byteLength(item.contentText ?? "")}::int)`,
          ),
        );
        if (excerpts.length) {
          await tx.execute(sql`UPDATE feed_items i SET content=NULL, content_raw=NULL, content_html=NULL,
            content_text=NULL, content_markdown=NULL, content_sanitizer_version=NULL, content_document=NULL,
            content_document_version=NULL, content_compiler_version=NULL
            FROM (VALUES ${sql.join(excerpts, sql`,`)}) AS candidate(url,digest,bytes)
            WHERE i.feed_id=${feed.id} AND i.canonical_url=candidate.url
              AND octet_length(coalesce(i.content_text,'')) < candidate.bytes
              AND encode(sha256(convert_to(i.content_raw,'UTF8')),'hex') = candidate.digest`);
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
              contentRaw: item.contentRaw,
              contentSanitizerVersion: item.contentSanitizerVersion,
              contentDocument: item.contentDocument,
              contentDocumentVersion: item.contentDocumentVersion,
              contentCompilerVersion: item.contentCompilerVersion,
              contentText: item.contentText,
              contentMarkdown: item.contentMarkdown,
              contentStatus: item.contentStatus,
              contentSource: item.contentSource,
              extractionErrorCode: item.extractionErrorCode,
              extractionErrorMessage: item.extractionErrorMessage,
              imageUrl: item.imageUrl,
              catalogExpiresAt: preview
                ? new Date(Math.min(item.publishedAt.getTime(), now.getTime()) + 7 * 86_400_000)
                : null,
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
              link: sql`CASE WHEN ${feedItems.link} !~* '^https?://' OR ${feedItems.link} ~ '#(item|entry)-[0-9]+$' THEN excluded.link ELSE ${feedItems.link} END`,
              summary: sql`CASE WHEN length(COALESCE(excluded.summary, '')) > length(COALESCE(${feedItems.summary}, '')) THEN excluded.summary ELSE ${feedItems.summary} END`,
              content: sql`COALESCE(${feedItems.content}, excluded.content)`,
              contentHtml: sql`COALESCE(${feedItems.contentHtml}, excluded.content_html)`,
              // Raw source fills in for rows stored before it was kept, so they can be recompiled;
              // the version follows content_html, which is only taken from the new row when empty.
              contentRaw: sql`COALESCE(${feedItems.contentRaw}, excluded.content_raw)`,
              contentSanitizerVersion: sql`CASE WHEN ${feedItems.contentHtml} IS NULL THEN excluded.content_sanitizer_version ELSE ${feedItems.contentSanitizerVersion} END`,
              // The document describes the retained body, so it is replaced only while the row holds none: an item
              // kept with Markdown, text or raw source (but no HTML) must not get a document of a newer body.
              contentDocument: sql`CASE WHEN ${feedItems.contentHtml} IS NULL AND ${feedItems.contentMarkdown} IS NULL AND ${feedItems.contentText} IS NULL AND ${feedItems.contentRaw} IS NULL THEN excluded.content_document ELSE ${feedItems.contentDocument} END`,
              contentDocumentVersion: sql`CASE WHEN ${feedItems.contentHtml} IS NULL AND ${feedItems.contentMarkdown} IS NULL AND ${feedItems.contentText} IS NULL AND ${feedItems.contentRaw} IS NULL THEN excluded.content_document_version ELSE ${feedItems.contentDocumentVersion} END`,
              contentCompilerVersion: sql`CASE WHEN ${feedItems.contentHtml} IS NULL AND ${feedItems.contentMarkdown} IS NULL AND ${feedItems.contentText} IS NULL AND ${feedItems.contentRaw} IS NULL THEN excluded.content_compiler_version ELSE ${feedItems.contentCompilerVersion} END`,
              contentText: sql`COALESCE(${feedItems.contentText}, excluded.content_text)`,
              contentMarkdown: sql`COALESCE(${feedItems.contentMarkdown}, excluded.content_markdown)`,
              contentStatus: sql`CASE WHEN ${feedItems.content} IS NULL AND excluded.content IS NOT NULL THEN excluded.content_status ELSE ${feedItems.contentStatus} END`,
              contentSource: sql`CASE WHEN ${feedItems.content} IS NULL AND excluded.content IS NOT NULL THEN excluded.content_source ELSE ${feedItems.contentSource} END`,
              extractionErrorCode: sql`COALESCE(${feedItems.extractionErrorCode}, excluded.extraction_error_code)`,
              extractionErrorMessage: sql`COALESCE(${feedItems.extractionErrorMessage}, excluded.extraction_error_message)`,
              imageUrl: sql`COALESCE(${feedItems.imageUrl}, excluded.image_url)`,
              catalogExpiresAt: sql`CASE WHEN excluded.catalog_expires_at IS NULL THEN NULL ELSE ${feedItems.catalogExpiresAt} END`,
              publishedAt: sql`LEAST(${feedItems.publishedAt}, excluded.published_at)`,
              updatedAt: now,
            },
          });
      }

      if (preview) {
        // Superseded preview entries become eligible for the bounded maintenance sweep.
        await tx.execute(sql`UPDATE feed_items SET catalog_expires_at=LEAST(catalog_expires_at,NOW())
          WHERE feed_id=${feed.id} AND catalog_expires_at > NOW() AND id NOT IN
          (SELECT id FROM feed_items WHERE feed_id=${feed.id} AND catalog_expires_at > NOW()
           ORDER BY published_at DESC, id DESC LIMIT 3)`);
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
    });

    if (needsFavicon) {
      const seed = nextLink ?? parsed.metadata.canonicalUrl;
      const resolved = await tryResolveFaviconMetadata(database, seed, parsed.metadata.iconUrl);
      if (resolved) {
        faviconPatch = {
          faviconUrl: resolved.url,
          faviconSource: resolved.source,
          faviconFetchedAt: new Date(),
        };
        await database
          .update(feeds)
          .set({
            ...faviconPatch,
            updatedAt: new Date(),
          })
          .where(eq(feeds.id, feed.id))
          .catch((error) => {
            console.warn("[ingestion] favicon persistence failed", {
              feedId: feed.id,
              error: error instanceof Error ? error.message : String(error),
            });
          });
      }
    }

    if (embeddingConfig) {
      const embeddingFeedCategories = await tryChannelEmbedding(
        { feed: feedForClassification, parsed },
        embeddingConfig,
        embeddingCategoryStats,
      );
      const embeddingItemCategoriesById = await tryItemEmbedding(
        { feed: feedForClassification, parsed: { metadata: parsed.metadata }, items },
        embeddingConfig,
        embeddingCategoryStats,
      );
      const embeddingItemAssignments = embeddingItemCategoriesById
        ? items.flatMap((item) => {
            const inferredCategoryLabels = embeddingItemCategoriesById.get(item.id);
            return inferredCategoryLabels === undefined
              ? []
              : [{ id: item.id, inferredCategoryLabels }];
          })
        : [];
      if (embeddingFeedCategories || embeddingItemAssignments.length > 0) {
        await syncInferredFeedCategories(
          database,
          {
            feedId: feed.id,
            feedCategories: embeddingFeedCategories ?? [],
            items: embeddingItemAssignments,
            model: embeddingModelInfo(embeddingConfig),
          },
          new Date(),
        ).catch((error) => {
          console.warn("[ingestion] embedding category persistence failed", {
            feedId: feed.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    }

    if (refreshSuperseded) {
      return skippedSupersededFeedRefresh();
    }

    await syncFeedToSearch(searchSync, {
      id: feed.id,
      ...parsed.metadata,
      iconUrl: faviconPatch?.faviconUrl ?? feed.faviconUrl ?? parsed.metadata.iconUrl,
    }).catch((error) => {
      console.warn("[ingestion] feed search sync failed", {
        feedId: feed.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return {
      ok: true,
      itemCount: items.length,
      feedBodyCount: items.filter((item) => Boolean(item.content)).length,
      articleExtractionCandidateIds,
      documentItemIds: preview
        ? []
        : items.filter((item) => item.contentDocument).map((item) => item.id),
      contentLimitStats: parsed.contentLimitStats,
      categoryStats: {
        feedClassifierLabels: feedCategories.length,
        itemClassifierLabels: itemCategoryStats.itemClassifierLabels,
        itemClassifierAbstentions: itemCategoryStats.itemClassifierAbstentions,
        suppressedFeedClassifierFallback: feedClassification.suppressedFallback,
        embeddingClassifier: embeddingCategoryStats,
        sourceTagAssignments,
      },
    };
  } catch (error) {
    let message = "Feed refresh failed";
    if (error instanceof Error) {
      const cause = (error as Error & { cause?: unknown }).cause;
      message = feedFailureMessage(cause instanceof Error ? cause.message : error.message);
    }
    const now = new Date();
    const backoffMs = 30 * 60 * 1000;
    try {
      const [updated] = await database
        .update(feeds)
        .set({
          refreshStatus: "failed",
          lastRefreshFailedAt: now,
          lastRefreshError: message,
          lastRefreshCompletedAt: now,
          nextRefreshAt: new Date(now.getTime() + backoffMs),
        })
        .where(and(eq(feeds.id, feedId), eq(feeds.refreshGeneration, generation)))
        .returning({ id: feeds.id });
      if (!updated) {
        logFeedRefreshSuperseded(feedId, generation, "failed");
        return skippedSupersededFeedRefresh();
      }
    } catch {}

    return {
      ok: false,
      itemCount: 0,
      error: message,
    };
  }
}
