import { AppError } from "@shared/errors/app-error";
import { discoverFeedUrlFromHtml } from "./discover-feed-url";
import { fetchFeedDocument } from "./fetch-feed";
import { assertHttpOrHttpsUrl, normalizeFeedUrl } from "./normalize-feed-url";
import { parseFeedMetadata } from "./parse-feed";

export type ResolvedRemoteFeed = {
  canonicalUrl: string;
  title: string;
  description: string;
  link: string | null;
  iconUrl: string | null;
};

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
): Promise<ResolvedRemoteFeed> {
  const normalizedInputUrl = normalizeFeedUrl(url);
  if (visitedUrls.has(normalizedInputUrl)) {
    throw new AppError("Failed to parse feed", { status: 500, code: "FEED_PARSE_FAILED" });
  }
  visitedUrls.add(normalizedInputUrl);

  const fetched = await fetchFeedDocument(url);
  if (!fetched.ok) {
    if (fetched.code === "BLOCKED_URL") {
      throw new AppError(fetched.error || "Invalid feed URL", {
        status: 400,
        code: "FEED_URL_FORBIDDEN",
      });
    }
    throw new AppError(fetched.error || "Could not fetch feed", {
      status: 503,
      code: "FEED_FETCH_FAILED",
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
    throw new AppError("Failed to parse feed", { status: 500, code: "FEED_PARSE_FAILED" });
  }
}
