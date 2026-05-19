import { absoluteUrl } from "../../lib/feed-url";
import { rawText } from "../../lib/feed-xml";

function embeddedJsonFeedIconUrl(feed: Record<string, unknown>, baseUrl: string): string | null {
  return (
    absoluteUrl(typeof feed.icon === "string" ? feed.icon : null, baseUrl) ??
    absoluteUrl(typeof feed.favicon === "string" ? feed.favicon : null, baseUrl)
  );
}

function embeddedRssFeedIconUrl(channel: Record<string, unknown>, baseUrl: string): string | null {
  const image = channel.image;
  if (typeof image === "string") {
    return absoluteUrl(image.trim() || null, baseUrl);
  }
  if (!image || typeof image !== "object") {
    return null;
  }
  const rec = image as Record<string, unknown>;
  return absoluteUrl(rawText(rec.url) ?? rawText(rec["@_href"]), baseUrl);
}

function embeddedAtomFeedIconUrl(feed: Record<string, unknown>, baseUrl: string): string | null {
  return absoluteUrl(rawText(feed.icon) ?? rawText(feed.logo), baseUrl);
}

export { embeddedAtomFeedIconUrl, embeddedJsonFeedIconUrl, embeddedRssFeedIconUrl };
