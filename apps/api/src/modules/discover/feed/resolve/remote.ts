import { Effect, Option, Result } from "effect";
import type { HttpClient } from "effect/http";
import { discoverFeedUrlFromHtml } from "@kyomi/ingest/ingestion";
import { AppLogger } from "@adapters/logger/service";
import { BadRequest, GatewayTimeout, InternalError, Unprocessable } from "@shared/effect/errors";
import { fetchFeedDocument, type FeedFetchFailed, type FetchedFeedDocument } from "../fetch";
import { assertHttpOrHttpsUrl, normalizeFeedUrl } from "../normalize";
import { parseFeedMetadata, parseHtmlMetadataFallback } from "../parse";

export type ResolvedRemoteFeed = {
  canonicalUrl: string;
  canonicalFeedUrl: string;
  submittedUrl: string;
  siteUrl: string | null;
  discoveredFromUrl: string | null;
  discoveryProvenance: string;
  title: string;
  description: string;
  link: string | null;
  iconUrl: string | null;
};

/** What `resolveRemoteFeed` can fail with; every case maps to a stable wire code. */
export type ResolveFeedError = BadRequest | InternalError | Unprocessable | GatewayTimeout;

type Resolution = Effect.Effect<
  ResolvedRemoteFeed,
  ResolveFeedError,
  HttpClient.HttpClient | AppLogger
>;

type RemoteFeedResolutionContext = {
  submittedUrl: string;
  discoveredFromUrl: string | null;
  discoveryProvenance: string;
};

function toHttpFallbackUrl(rawUrl: string): string | null {
  try {
    const parsed = assertHttpOrHttpsUrl(rawUrl);
    if (parsed.protocol !== "https:") {
      return null;
    }
    parsed.protocol = "http:";
    return parsed.href;
  } catch {
    return null;
  }
}

/** The base-site URL a `/feed` or `/rss` URL hangs off, or null when `url` is not of that shape. */
function toBaseUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!/\/(feed|rss)\/?$/i.test(parsed.pathname)) {
    return null;
  }
  parsed.pathname = parsed.pathname.replace(/\/(feed|rss)\/?$/i, "/");
  return parsed.href;
}

function tlsRetryOrHttpFallback(
  url: string,
  visitedUrls: Set<string>,
  context: RemoteFeedResolutionContext,
  ignoreTlsError: boolean,
): Resolution | null {
  if (!ignoreTlsError) {
    return Effect.gen(function* () {
      const log = yield* AppLogger;
      yield* log.warn("discover.feed.tls_failed_retrying", { url });
      return yield* resolveFromUrl(url, visitedUrls, context, true);
    });
  }
  const httpFallbackUrl = toHttpFallbackUrl(url);
  if (!httpFallbackUrl || visitedUrls.has(normalizeFeedUrl(httpFallbackUrl))) {
    return null;
  }
  return resolveFromUrl(httpFallbackUrl, visitedUrls, {
    ...context,
    discoveredFromUrl: url,
    discoveryProvenance: "http_fallback",
  });
}

function baseUrlFallbackOn404(
  url: string,
  visitedUrls: Set<string>,
  ignoreTlsError: boolean,
  context: RemoteFeedResolutionContext,
): Resolution | null {
  const baseUrl = toBaseUrl(url);
  if (!baseUrl || visitedUrls.has(normalizeFeedUrl(baseUrl))) {
    return null;
  }
  return Effect.gen(function* () {
    const log = yield* AppLogger;
    yield* log.warn("discover.feed.fallback_to_base_url", { url, baseUrl });
    return yield* resolveFromUrl(
      baseUrl,
      visitedUrls,
      { ...context, discoveredFromUrl: url, discoveryProvenance: "base_url_fallback" },
      ignoreTlsError,
    );
  });
}

/** Picks the recovery for a failed fetch (TLS retry, http fallback, base URL) or fails with its wire error. */
const handleFailedFeedFetch = Effect.fn("discover.handleFailedFeedFetch")(function* (
  url: string,
  visitedUrls: Set<string>,
  ignoreTlsError: boolean,
  failure: FeedFetchFailed,
  context: RemoteFeedResolutionContext,
): Effect.fn.Return<ResolvedRemoteFeed, ResolveFeedError, HttpClient.HttpClient | AppLogger> {
  if (failure.code === "BLOCKED_URL") {
    return yield* new BadRequest({
      message: failure.message || "Invalid feed URL",
      code: "FEED_URL_FORBIDDEN",
    });
  }

  if (failure.code === "TLS_CERTIFICATE_FAILED") {
    const recovery = tlsRetryOrHttpFallback(url, visitedUrls, context, ignoreTlsError);
    if (recovery) {
      return yield* recovery;
    }
  }

  if (failure.status === 404) {
    const recovery = baseUrlFallbackOn404(url, visitedUrls, ignoreTlsError, context);
    if (recovery) {
      return yield* recovery;
    }
  }

  const log = yield* AppLogger;
  yield* log.warn("discover.feed.fetch_failed", {
    url,
    fetchCode: failure.code,
    fetchError: failure.message,
    fetchStatus: failure.status,
  });

  const Failed = failure.code === "FETCH_TIMEOUT" ? GatewayTimeout : Unprocessable;
  return yield* new Failed({
    message: "Could not fetch feed",
    code: "FEED_FETCH_FAILED",
    details: {
      fetchCode: failure.code,
      fetchError: failure.message,
      fetchStatus: failure.status,
    },
  });
});

const resolveFromFetchedBody = Effect.fn("discover.resolveFromFetchedBody")(function* (
  fetched: FetchedFeedDocument,
  visitedUrls: Set<string>,
  context: RemoteFeedResolutionContext,
): Effect.fn.Return<ResolvedRemoteFeed, ResolveFeedError, HttpClient.HttpClient | AppLogger> {
  const parsed = yield* Effect.option(
    Effect.try(() => ({
      meta: parseFeedMetadata(fetched.body, fetched.finalUrl),
      canonicalUrl: normalizeFeedUrl(fetched.finalUrl),
    })),
  );
  if (Option.isSome(parsed)) {
    const { meta, canonicalUrl } = parsed.value;
    return {
      canonicalUrl,
      canonicalFeedUrl: canonicalUrl,
      submittedUrl: context.submittedUrl,
      siteUrl: meta.link,
      discoveredFromUrl: context.discoveredFromUrl,
      discoveryProvenance: context.discoveryProvenance,
      title: meta.title,
      description: meta.description,
      link: meta.link,
      iconUrl: meta.iconUrl,
    };
  }

  // Not a feed: follow an advertised feed link, else describe the page itself.
  const discoveredFeedUrl = discoverFeedUrlFromHtml(fetched.body, fetched.finalUrl);
  if (discoveredFeedUrl) {
    return yield* resolveFromUrl(discoveredFeedUrl, visitedUrls, {
      ...context,
      discoveredFromUrl: fetched.finalUrl,
      discoveryProvenance: "html_autodiscovery",
    });
  }

  const meta = parseHtmlMetadataFallback(fetched.body, fetched.finalUrl);
  const canonicalUrl = normalizeFeedUrl(fetched.finalUrl);
  return {
    canonicalUrl,
    canonicalFeedUrl: canonicalUrl,
    submittedUrl: context.submittedUrl,
    siteUrl: meta.link,
    discoveredFromUrl: context.discoveredFromUrl,
    discoveryProvenance:
      context.discoveryProvenance === "direct"
        ? "html_metadata_fallback"
        : context.discoveryProvenance,
    title: meta.title,
    description: meta.description,
    link: meta.link,
    iconUrl: meta.iconUrl,
  };
});

const resolveFromUrl = Effect.fn("discover.resolveFromUrl")(function* (
  url: string,
  visitedUrls: Set<string>,
  context: RemoteFeedResolutionContext,
  ignoreTlsError = false,
): Effect.fn.Return<ResolvedRemoteFeed, ResolveFeedError, HttpClient.HttpClient | AppLogger> {
  const normalizedInputUrl = normalizeFeedUrl(url);
  if (visitedUrls.has(normalizedInputUrl)) {
    // A TLS retry revisits the same URL on purpose; any other revisit is a redirect loop.
    if (!ignoreTlsError) {
      return yield* new InternalError({
        message: "Failed to parse feed",
        code: "FEED_PARSE_FAILED",
      });
    }
  } else {
    visitedUrls.add(normalizedInputUrl);
  }

  const fetched = yield* Effect.result(fetchFeedDocument(url, { ignoreTlsError }));
  if (Result.isFailure(fetched)) {
    return yield* handleFailedFeedFetch(url, visitedUrls, ignoreTlsError, fetched.failure, context);
  }
  return yield* resolveFromFetchedBody(fetched.success, visitedUrls, context);
});

/** Fetch URL, follow redirects, parse RSS/Atom/JSON Feed, return canonical URL + metadata. */
export const resolveRemoteFeed = Effect.fn("discover.resolveRemoteFeed")(function* (
  rawUrl: string,
): Effect.fn.Return<ResolvedRemoteFeed, ResolveFeedError, HttpClient.HttpClient | AppLogger> {
  const trimmed = rawUrl.trim();
  const initial = yield* Effect.try({
    try: () => {
      if (!trimmed) {
        throw new Error("empty");
      }
      return assertHttpOrHttpsUrl(trimmed);
    },
    catch: () => new BadRequest({ message: "Invalid feed URL", code: "INVALID_FEED_URL" }),
  });

  return yield* resolveFromUrl(initial.href, new Set(), {
    submittedUrl: initial.href,
    discoveredFromUrl: null,
    discoveryProvenance: "direct",
  });
});
