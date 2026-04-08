import { XMLParser } from "fast-xml-parser";

export type ParsedFeedMetadata = {
  title: string;
  description: string;
  link: string | null;
};

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlText(value: unknown): string {
  if (typeof value === "string") {
    return stripTags(value).trim();
  }
  if (value && typeof value === "object" && "#text" in value) {
    return stripTags(String((value as { "#text": unknown })["#text"])).trim();
  }
  return "";
}

function pickLinkFromRssChannel(link: unknown, fallback: string): string | null {
  if (typeof link === "string" && link.trim()) {
    return link.trim();
  }
  if (Array.isArray(link)) {
    for (const item of link) {
      if (typeof item === "string" && item.trim()) {
        return item.trim();
      }
      if (item && typeof item === "object" && "#text" in item) {
        const t = String((item as { "#text": unknown })["#text"]).trim();
        if (t) {
          return t;
        }
      }
    }
  }
  return fallback || null;
}

function pickAtomLink(feed: Record<string, unknown>, fallback: string): string | null {
  const link = feed.link;
  if (!link) {
    return fallback || null;
  }
  const candidates = Array.isArray(link) ? link : [link];
  for (const item of candidates) {
    if (item && typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const rel = rec["@_rel"];
      const href = rec["@_href"];
      if (typeof href === "string" && href) {
        if (rel === "alternate" || rel === undefined || rel === "self") {
          return href;
        }
      }
    }
  }
  for (const item of candidates) {
    if (item && typeof item === "object") {
      const href = (item as Record<string, unknown>)["@_href"];
      if (typeof href === "string" && href) {
        return href;
      }
    }
  }
  return fallback || null;
}

function parseJsonFeedPreview(body: string, fallbackUrl: string): ParsedFeedMetadata {
  const data: unknown = JSON.parse(body);
  if (!data || typeof data !== "object") {
    throw new Error("Invalid JSON feed root");
  }
  const rec = data as Record<string, unknown>;
  const title = typeof rec.title === "string" ? stripTags(rec.title) : "Untitled";
  const description =
    typeof rec.description === "string"
      ? stripTags(rec.description)
      : "Follow recent articles from this feed";
  const home = typeof rec.home_page_url === "string" ? rec.home_page_url : fallbackUrl;
  return {
    title: title || "Untitled",
    description: description || "Follow recent articles from this feed",
    link: home || null,
  };
}

function parseRssChannel(
  channel: Record<string, unknown>,
  fallbackUrl: string,
): ParsedFeedMetadata {
  const title = xmlText(channel.title) || "Untitled";
  const description = xmlText(channel.description) || "Follow recent articles from this feed";
  const link = pickLinkFromRssChannel(channel.link, fallbackUrl);
  return { title, description, link };
}

function parseAtomFeed(feed: Record<string, unknown>, fallbackUrl: string): ParsedFeedMetadata {
  const title = xmlText(feed.title) || "Untitled";
  const subtitle = xmlText(feed.subtitle);
  const description = subtitle || "Follow recent articles from this feed";
  const link = pickAtomLink(feed, fallbackUrl);
  return { title, description, link };
}

/**
 * Extract channel-level metadata from RSS, Atom, or JSON Feed document text.
 */
export function parseFeedMetadata(body: string, resolvedUrl: string): ParsedFeedMetadata {
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) {
    return parseJsonFeedPreview(trimmed, resolvedUrl);
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    trimValues: true,
  });
  const doc: unknown = parser.parse(trimmed);
  if (!doc || typeof doc !== "object") {
    throw new Error("Empty XML document");
  }
  const root = doc as Record<string, unknown>;

  if (root.rss && typeof root.rss === "object") {
    const rss = root.rss as Record<string, unknown>;
    const channel = rss.channel;
    if (channel && typeof channel === "object") {
      return parseRssChannel(channel as Record<string, unknown>, resolvedUrl);
    }
  }

  if (root.feed && typeof root.feed === "object") {
    return parseAtomFeed(root.feed as Record<string, unknown>, resolvedUrl);
  }

  throw new Error("Unsupported feed format (expected RSS, Atom, or JSON Feed)");
}
