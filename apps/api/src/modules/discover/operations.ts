import { Effect } from "effect";
import type { HttpClient } from "effect/http";
import { Db } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import {
  FeedSearch,
  type FeedSearchDocument,
  type FeedSearchError,
} from "@adapters/search/service";
import type { DatabaseError } from "@shared/effect/errors";
import { serializeError } from "@shared/errors/serialize";
import { decodeNullableText, decodeText } from "@shared/text/entities";
import { dedupeFeedSearchResults } from "./dedupe";
import { assertHttpOrHttpsUrl, normalizeFeedUrl } from "./feed/normalize";
import { resolveRemoteFeed, type ResolveFeedError } from "./feed/resolve/remote";
import {
  findFeedByUrl,
  findFeedsWithSubscription,
  findFeedWithSubscription,
  isFollowingFeed,
  searchFeedRows,
} from "./queries";
import type { FeedPreviewDto, FeedSearchResultDto } from "./types";

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;
const SEARCH_DEDUPE_SCAN_FACTOR = 4;
const SEARCH_DEDUPE_SCAN_LIMIT = 200;

function normalizeExistingFeedLookupUrl(rawUrl: string): string | null {
  try {
    return normalizeFeedUrl(assertHttpOrHttpsUrl(rawUrl).href);
  } catch {
    return null;
  }
}

function getSearchScanLimit(limit: number): number {
  return Math.min(Math.max(limit * SEARCH_DEDUPE_SCAN_FACTOR, limit), SEARCH_DEDUPE_SCAN_LIMIT);
}

/** The `limit` query parameter as a usable page size: a number in 1..50, defaulting to 20. */
function clampSearchLimit(rawLimit: number | string | undefined): number {
  const requested = Number(rawLimit ?? DEFAULT_SEARCH_LIMIT) || DEFAULT_SEARCH_LIMIT;
  return Math.min(MAX_SEARCH_LIMIT, Math.max(1, requested));
}

const previewExistingFeedByUrl = Effect.fn("discover.previewExistingFeed")(function* (
  userId: string,
  rawUrl: string,
) {
  const normalizedUrl = normalizeExistingFeedLookupUrl(rawUrl);
  if (!normalizedUrl) {
    return null;
  }
  const existing = yield* findFeedWithSubscription(userId, normalizedUrl);
  if (!existing) {
    return null;
  }
  const preview: FeedPreviewDto = {
    id: existing.id,
    url: existing.url,
    title: decodeText(existing.title),
    description: decodeNullableText(existing.description) ?? "",
    link: existing.link,
    faviconUrl: existing.faviconUrl,
    isSubscribed: existing.isSubscribed,
  };
  return preview;
});

export const previewFeedFromUrl = Effect.fn("discover.previewFeed")(function* (
  userId: string,
  rawUrl: string,
): Effect.fn.Return<
  FeedPreviewDto,
  ResolveFeedError | DatabaseError,
  Db | HttpClient.HttpClient | AppLogger
> {
  const existingPreview = yield* previewExistingFeedByUrl(userId, rawUrl);
  if (existingPreview) {
    return existingPreview;
  }

  const resolved = yield* resolveRemoteFeed(rawUrl);
  const existingFeed = yield* findFeedByUrl(resolved.canonicalUrl);
  const isSubscribed = existingFeed ? yield* isFollowingFeed(userId, existingFeed.id) : false;

  // Keep preview snappy: avoid blocking on remote favicon probing.
  return {
    id: existingFeed?.id ?? null,
    url: resolved.canonicalUrl,
    title: decodeText(resolved.title),
    description: decodeText(resolved.description),
    link: resolved.link,
    faviconUrl: existingFeed?.faviconUrl ?? resolved.iconUrl ?? null,
    isSubscribed,
  };
});

/** `GET /discover/preview`: preview a feed URL for `userId`, then log the outcome. */
export const previewFeedForUser = Effect.fn("discover.preview")(function* (
  userId: string,
  rawUrl: string,
) {
  const log = yield* AppLogger;
  const preview = yield* previewFeedFromUrl(userId, rawUrl);
  yield* log.info("discover.preview.ok", {
    userId,
    url: preview.url,
    isSubscribed: preview.isSubscribed,
  });
  return preview;
});

/** Results from Meilisearch hits, joined to the feeds Postgres knows (a stale hit stays followable by URL). */
const searchWithMeili = Effect.fn("discover.searchMeili")(function* (
  userId: string,
  query: string,
  hits: FeedSearchDocument[],
  limit: number,
) {
  const log = yield* AppLogger;
  const rows = yield* findFeedsWithSubscription(
    userId,
    hits.map((hit) => hit.id),
  );
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const results: FeedSearchResultDto[] = hits.map((hit) => {
    const row = rowsById.get(hit.id);
    if (!row) {
      return {
        id: null,
        url: hit.url,
        title: decodeText(hit.title),
        description: decodeNullableText(hit.description),
        link: hit.link,
        faviconUrl: hit.faviconUrl ?? null,
        isSubscribed: false,
      };
    }
    return {
      id: row.id,
      url: row.url,
      title: decodeText(row.title),
      description: decodeNullableText(row.description),
      link: row.link,
      faviconUrl: row.faviconUrl ?? null,
      isSubscribed: row.isSubscribed,
    };
  });

  const staleHitCount = hits.filter((hit) => !rowsById.has(hit.id)).length;
  if (staleHitCount > 0) {
    yield* log.warn("discover.search.meili_stale_hits", {
      userId,
      query,
      limit,
      staleHitCount,
    });
  }
  return results;
});

const searchWithDatabase = Effect.fn("discover.searchDatabase")(function* (
  userId: string,
  query: string,
  scanLimit: number,
) {
  const rows = yield* searchFeedRows(userId, query, scanLimit);
  return rows.map(
    ({ score: _score, ...row }): FeedSearchResultDto => ({
      ...row,
      title: decodeText(row.title),
      description: decodeNullableText(row.description),
    }),
  );
});

/**
 * Feed search for `userId`. When Meilisearch is configured it answers (no hits means no results);
 * a failure anywhere in that branch (Meilisearch, or the Postgres join over its hits) is logged as
 * `discover.search.meili_fallback` and the search is answered from Postgres instead. If Postgres
 * fails too the `DatabaseError` propagates (a 500), so an outage never reads as "no matches".
 */
export const searchFeeds = Effect.fn("discover.searchFeeds")(function* (
  userId: string,
  rawQuery: string,
  limit = DEFAULT_SEARCH_LIMIT,
): Effect.fn.Return<FeedSearchResultDto[], DatabaseError, Db | AppLogger | FeedSearch> {
  const query = rawQuery.trim();
  if (!query) {
    return [];
  }

  const log = yield* AppLogger;
  const search = yield* FeedSearch;
  const safeLimit = Math.min(Math.max(limit, 1), MAX_SEARCH_LIMIT);
  const scanLimit = getSearchScanLimit(safeLimit);

  const source = search.isConfigured() ? "meili" : "database";
  const results =
    source === "meili"
      ? yield* search.search(query, scanLimit).pipe(
          Effect.flatMap((hits) =>
            hits.length === 0
              ? Effect.succeed([])
              : searchWithMeili(userId, query, hits, safeLimit),
          ),
          Effect.catch((error: FeedSearchError | DatabaseError) =>
            log
              .warn("discover.search.meili_fallback", {
                userId,
                query,
                limit: scanLimit,
                error: serializeError(error),
                errorCode: error._tag === "Unavailable" ? error.code : undefined,
              })
              .pipe(Effect.andThen(searchWithDatabase(userId, query, scanLimit))),
          ),
        )
      : yield* searchWithDatabase(userId, query, scanLimit);

  const deduped = dedupeFeedSearchResults(results, safeLimit);
  if (deduped.duplicateCount > 0) {
    yield* log.info("discover.search.deduped", {
      userId,
      query,
      duplicateCount: deduped.duplicateCount,
      returnedCount: deduped.items.length,
      scannedCount: results.length,
      source,
    });
  }
  return deduped.items;
});

/** `GET /discover/search`: search for `userId` with the request's raw `limit`, then log the outcome. */
export const searchFeedsForUser = Effect.fn("discover.search")(function* (
  userId: string,
  query: string,
  rawLimit: number | string | undefined,
) {
  const log = yield* AppLogger;
  const items = yield* searchFeeds(userId, query, clampSearchLimit(rawLimit));
  yield* log.info("discover.search.ok", { userId, query, resultCount: items.length });
  return items;
});
