import { AppError } from "@shared/errors/app-error";
import { logger } from "@adapters/logger";
import { discoverFeedUrlFromHtml } from "./discover-feed-url";
import { fetchFeedDocument } from "./fetch-feed";
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
    if (fetched.code === "BLOCKED_URL") {
      throw new AppError(fetched.error || "Invalid feed URL", {
        status: 400,
        code: "FEED_URL_FORBIDDEN",
      });
    }
    if (fetched.code === "TLS_CERTIFICATE_FAILED") {
      if (!ignoreTlsError) {
        logger.warn("discover.feed.tls_failed_retrying", { url, error: fetched.error });
        return await resolveRemoteFeedFromUrl(url, visitedUrls, true);
      }

      const httpFallbackUrl = toHttpFallbackUrl(url);
      if (httpFallbackUrl) {
        const normalizedFallbackUrl = normalizeFeedUrl(httpFallbackUrl);
        if (!visitedUrls.has(normalizedFallbackUrl)) {
          return await resolveRemoteFeedFromUrl(httpFallbackUrl, visitedUrls, false);
        }
      }
    }

    if (fetched.status === 404) {
      try {
        const parsedUrl = new URL(url);
        if (parsedUrl.pathname.match(/\/(feed|rss)\/?$/i)) {
          parsedUrl.pathname = parsedUrl.pathname.replace(/\/(feed|rss)\/?$/i, "/");
          const baseUrl = parsedUrl.href;
          const normalizedBaseUrl = normalizeFeedUrl(baseUrl);
          if (!visitedUrls.has(normalizedBaseUrl)) {
            logger.warn("discover.feed.fallback_to_base_url", { url, baseUrl });
            return await resolveRemoteFeedFromUrl(baseUrl, visitedUrls, ignoreTlsError);
          }
        }
      } catch {
        // Ignore URL parsing errors during fallback
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

    // HTML Fallback for sites with no feeds
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
