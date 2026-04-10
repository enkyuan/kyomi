import { AppError } from "@shared/errors/app-error";
import { fetchFeedDocument } from "./discover.fetch-feed";
import { assertHttpOrHttpsUrl, normalizeFeedUrl } from "./discover.normalize-feed-url";
import { parseFeedMetadata } from "./discover.parse-feed";

export type ResolvedRemoteFeed = {
  canonicalUrl: string;
  title: string;
  description: string;
  link: string | null;
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

  const fetched = await fetchFeedDocument(initial.href);
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

  let meta;
  try {
    meta = parseFeedMetadata(fetched.body, fetched.finalUrl);
  } catch {
    throw new AppError("Failed to parse feed", { status: 500, code: "FEED_PARSE_FAILED" });
  }

  const canonicalUrl = normalizeFeedUrl(fetched.finalUrl);

  return {
    canonicalUrl,
    title: meta.title,
    description: meta.description,
    link: meta.link,
  };
}
