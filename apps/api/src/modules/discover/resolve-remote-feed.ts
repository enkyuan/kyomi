import { AppError } from "@shared/errors/app-error";
import { logger } from "@adapters/logger";
import { discoverFeedUrlFromHtml } from "./discover-feed-url";
import { fetchFeedDocument, type FetchFeedDocumentResult } from "./fetch-feed";
import { assertHttpOrHttpsUrl, normalizeFeedUrl } from "./normalize-feed-url";
import { parseFeedMetadata, parseHtmlMetadataFallback } from "./parse-feed";

export type ResolvedRemoteFeed = {
  canonicalUrl: string;
  title: string;
  description: string;
  link: string | null;
  iconUrl: string | null;
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

async function tryTlsRetryOrHttpFallback(
  url: string,
  visitedUrls: Set<string>,
): Promise<ResolvedRemoteFeed | null> {
  logger.warn("discover.feed.tls_failed_retrying", { url });
  return await resolveRemoteFeedFromUrl(url, visitedUrls, true);
}

async function tryHttpFallbackAfterTls(
  url: string,
  visitedUrls: Set<string>,
): Promise<ResolvedRemoteFeed | null> {
  const httpFallbackUrl = toHttpFallbackUrl(url);
  if (!httpFallbackUrl) {
    return null;
  }
  const normalizedFallbackUrl = normalizeFeedUrl(httpFallbackUrl);
  if (visitedUrls.has(normalizedFallbackUrl)) {
    return null;
  }
  return await resolveRemoteFeedFromUrl(httpFallbackUrl, visitedUrls, false);
}

async function tryBaseUrlFallbackOn404(
  url: string,
  visitedUrls: Set<string>,
  ignoreTlsError: boolean,
): Promise<ResolvedRemoteFeed | null> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  if (!parsedUrl.pathname.match(/\/(feed|rss)\/?$/i)) {
    return null;
  }

  parsedUrl.pathname = parsedUrl.pathname.replace(/\/(feed|rss)\/?$/i, "/");
  const baseUrl = parsedUrl.href;
  const normalizedBaseUrl = normalizeFeedUrl(baseUrl);
  if (visitedUrls.has(normalizedBaseUrl)) {
    return null;
  }

  logger.warn("discover.feed.fallback_to_base_url", { url, baseUrl });
  return await resolveRemoteFeedFromUrl(baseUrl, visitedUrls, ignoreTlsError);
}

async function handleFailedFeedFetch(
  url: string,
  visitedUrls: Set<string>,
  ignoreTlsError: boolean,
  fetched: Extract<FetchFeedDocumentResult, { ok: false }>,
): Promise<ResolvedRemoteFeed> {
  if (fetched.code === "BLOCKED_URL") {
    throw new AppError(fetched.error || "Invalid feed URL", {
      status: 400,
      code: "FEED_URL_FORBIDDEN",
    });
  }

  if (fetched.code === "TLS_CERTIFICATE_FAILED") {
    if (!ignoreTlsError) {
      const tlsRetry = await tryTlsRetryOrHttpFallback(url, visitedUrls);
      if (tlsRetry) {
        return tlsRetry;
      }
    }
    const httpFallback = await tryHttpFallbackAfterTls(url, visitedUrls);
    if (httpFallback) {
      return httpFallback;
    }
  }

  if (fetched.status === 404) {
    const baseFallback = await tryBaseUrlFallbackOn404(url, visitedUrls, ignoreTlsError);
    if (baseFallback) {
      return baseFallback;
    }
  }

  logger.warn("discover.feed.fetch_failed", {
    url,
    fetchCode: fetched.code,
    fetchError: fetched.error,
    fetchStatus: fetched.status,
  });

  throw new AppError("Could not fetch feed", {
    status: fetched.code === "FETCH_TIMEOUT" ? 504 : 422,
    code: "FEED_FETCH_FAILED",
    details: {
      fetchCode: fetched.code,
      fetchError: fetched.error,
      fetchStatus: fetched.status,
    },
  });
}

async function resolveFromFetchedBody(
  fetched: Extract<FetchFeedDocumentResult, { ok: true }>,
  visitedUrls: Set<string>,
): Promise<ResolvedRemoteFeed> {
  try {
    const meta = parseFeedMetadata(fetched.body, fetched.finalUrl);
    return {
      canonicalUrl: normalizeFeedUrl(fetched.finalUrl),
      title: meta.title,
      description: meta.description,
      link: meta.link,
      iconUrl: meta.iconUrl,
    };
  } catch {
    const discoveredFeedUrl = discoverFeedUrlFromHtml(fetched.body, fetched.finalUrl);
    if (discoveredFeedUrl) {
      return await resolveRemoteFeedFromUrl(discoveredFeedUrl, visitedUrls);
    }

    const meta = parseHtmlMetadataFallback(fetched.body, fetched.finalUrl);
    return {
      canonicalUrl: normalizeFeedUrl(fetched.finalUrl),
      title: meta.title,
      description: meta.description,
      link: meta.link,
      iconUrl: meta.iconUrl,
    };
  }
}

/** Fetch URL, follow redirects, parse RSS/Atom/JSON Feed, return canonical URL + metadata. */
export async function resolveRemoteFeed(rawUrl: string): Promise<ResolvedRemoteFeed> {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new AppError("Invalid feed URL", { status: 400, code: "INVALID_FEED_URL" });
  }

  let initial: URL;
  try {
    initial = assertHttpOrHttpsUrl(trimmed);
  } catch {
    throw new AppError("Invalid feed URL", { status: 400, code: "INVALID_FEED_URL" });
  }

  return await resolveRemoteFeedFromUrl(initial.href, new Set());
}

async function resolveRemoteFeedFromUrl(
  url: string,
  visitedUrls: Set<string>,
  ignoreTlsError = false,
): Promise<ResolvedRemoteFeed> {
  const normalizedInputUrl = normalizeFeedUrl(url);
  if (visitedUrls.has(normalizedInputUrl)) {
    throw new AppError("Failed to parse feed", { status: 500, code: "FEED_PARSE_FAILED" });
  }
  visitedUrls.add(normalizedInputUrl);

  const fetched = await fetchFeedDocument(url, { ignoreTlsError });
  if (!fetched.ok) {
    return await handleFailedFeedFetch(url, visitedUrls, ignoreTlsError, fetched);
  }

  return await resolveFromFetchedBody(fetched, visitedUrls);
}
