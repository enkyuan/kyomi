import { AppError } from "@shared/errors/app";
import { logger } from "@adapters/logger";
import { discoverFeedUrlFromHtml } from "./discover-url";
import { fetchFeedDocument, type FetchFeedDocumentResult } from "./fetch";
import { assertHttpOrHttpsUrl, normalizeFeedUrl } from "./normalize-url";
import { parseFeedMetadata, parseHtmlMetadataFallback } from "./parse";

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

async function tryTlsRetryOrHttpFallback(
  url: string,
  visitedUrls: Set<string>,
  context: RemoteFeedResolutionContext,
): Promise<ResolvedRemoteFeed | null> {
  logger.warn("discover.feed.tls_failed_retrying", { url });
  return await resolveRemoteFeedFromUrl(url, visitedUrls, context, true);
}

async function tryHttpFallbackAfterTls(
  url: string,
  visitedUrls: Set<string>,
  context: RemoteFeedResolutionContext,
): Promise<ResolvedRemoteFeed | null> {
  const httpFallbackUrl = toHttpFallbackUrl(url);
  if (!httpFallbackUrl) {
    return null;
  }
  const normalizedFallbackUrl = normalizeFeedUrl(httpFallbackUrl);
  if (visitedUrls.has(normalizedFallbackUrl)) {
    return null;
  }
  return await resolveRemoteFeedFromUrl(httpFallbackUrl, visitedUrls, {
    ...context,
    discoveredFromUrl: url,
    discoveryProvenance: "http_fallback",
  });
}

async function tryBaseUrlFallbackOn404(
  url: string,
  visitedUrls: Set<string>,
  ignoreTlsError: boolean,
  context: RemoteFeedResolutionContext,
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
  return await resolveRemoteFeedFromUrl(
    baseUrl,
    visitedUrls,
    {
      ...context,
      discoveredFromUrl: url,
      discoveryProvenance: "base_url_fallback",
    },
    ignoreTlsError,
  );
}

async function handleFailedFeedFetch(
  url: string,
  visitedUrls: Set<string>,
  ignoreTlsError: boolean,
  fetched: Extract<FetchFeedDocumentResult, { ok: false }>,
  context: RemoteFeedResolutionContext,
): Promise<ResolvedRemoteFeed> {
  if (fetched.code === "BLOCKED_URL") {
    throw new AppError(fetched.error || "Invalid feed URL", {
      status: 400,
      code: "FEED_URL_FORBIDDEN",
    });
  }

  if (fetched.code === "TLS_CERTIFICATE_FAILED") {
    if (!ignoreTlsError) {
      const tlsRetry = await tryTlsRetryOrHttpFallback(url, visitedUrls, context);
      if (tlsRetry) {
        return tlsRetry;
      }
    }
    const httpFallback = await tryHttpFallbackAfterTls(url, visitedUrls, context);
    if (httpFallback) {
      return httpFallback;
    }
  }

  if (fetched.status === 404) {
    const baseFallback = await tryBaseUrlFallbackOn404(
      url,
      visitedUrls,
      ignoreTlsError,
      context,
    );
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
  context: RemoteFeedResolutionContext,
): Promise<ResolvedRemoteFeed> {
  try {
    const meta = parseFeedMetadata(fetched.body, fetched.finalUrl);
    const canonicalUrl = normalizeFeedUrl(fetched.finalUrl);
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
  } catch {
    const discoveredFeedUrl = discoverFeedUrlFromHtml(fetched.body, fetched.finalUrl);
    if (discoveredFeedUrl) {
      return await resolveRemoteFeedFromUrl(discoveredFeedUrl, visitedUrls, {
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

  return await resolveRemoteFeedFromUrl(initial.href, new Set(), {
    submittedUrl: initial.href,
    discoveredFromUrl: null,
    discoveryProvenance: "direct",
  });
}

async function resolveRemoteFeedFromUrl(
  url: string,
  visitedUrls: Set<string>,
  context: RemoteFeedResolutionContext,
  ignoreTlsError = false,
): Promise<ResolvedRemoteFeed> {
  const normalizedInputUrl = normalizeFeedUrl(url);
  if (visitedUrls.has(normalizedInputUrl)) {
    if (!ignoreTlsError) {
      throw new AppError("Failed to parse feed", { status: 500, code: "FEED_PARSE_FAILED" });
    }
  } else {
    visitedUrls.add(normalizedInputUrl);
  }

  const fetched = await fetchFeedDocument(url, { ignoreTlsError });
  if (!fetched.ok) {
    return await handleFailedFeedFetch(url, visitedUrls, ignoreTlsError, fetched, context);
  }

  return await resolveFromFetchedBody(fetched, visitedUrls, context);
}
