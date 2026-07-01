import { XMLParser, type X2jOptions } from "fast-xml-parser";
import { normalizeArticleUrl } from "../../lib/article-identity";
import {
  buildStoredFeedContent,
  extractImageUrl,
  stripTags,
  summarizeText,
} from "../../lib/feed-text";
import type { ParsedFeedDocument } from "./types";

const FEED_XML_PROCESS_ENTITIES: NonNullable<X2jOptions["processEntities"]> = {
  enabled: true,
  maxEntitySize: 10_000,
  maxExpansionDepth: 10,
  maxTotalExpansions: 50_000,
  maxExpandedLength: 1_000_000,
  maxEntityCount: 100,
};

function stableUuid(seed: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  const bytes = new Uint8Array(16);
  let state = hash >>> 0;
  for (let i = 0; i < bytes.length; i += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    bytes[i] = state & 0xff;
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function computeFeedItemId(feedId: string, stableIdentity: string): string {
  return stableUuid(`${feedId}|${stableIdentity}`);
}

function normalizeFeedUrl(raw: string): string {
  const trimmed = raw.trim();
  const url = new URL(trimmed);
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.href;
}

function absoluteUrl(candidate: string | null, baseUrl: string): string | null {
  if (!candidate) {
    return null;
  }
  try {
    return new URL(candidate, baseUrl).href;
  } catch {
    return null;
  }
}

function absoluteHttpUrl(candidate: string | null, baseUrl: string): string | null {
  const href = absoluteUrl(candidate, baseUrl);
  if (!href) {
    return null;
  }
  try {
    const parsed = new URL(href);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
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

function rawText(value: unknown): string | null {
  if (typeof value === "string") {
    return value.trim() || null;
  }
  if (value && typeof value === "object" && "#text" in value) {
    const raw = String((value as { "#text": unknown })["#text"]).trim();
    return raw || null;
  }
  return null;
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  return value == null ? [] : [value];
}

function pickRssLink(link: unknown, fallback: string): string {
  if (typeof link === "string" && link.trim()) {
    return link.trim();
  }
  for (const candidate of toArray(link)) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    if (candidate && typeof candidate === "object" && "#text" in candidate) {
      const text = String((candidate as { "#text": unknown })["#text"]).trim();
      if (text) {
        return text;
      }
    }
  }
  return fallback;
}

function pickAtomLink(link: unknown, fallback: string): string {
  const candidates = toArray(link);
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }
    const record = candidate as Record<string, unknown>;
    const rel = record["@_rel"];
    const href = record["@_href"];
    if (typeof href === "string" && href.trim()) {
      if (rel === "alternate" || rel === undefined || rel === "self") {
        return href.trim();
      }
    }
  }
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }
    const href = (candidate as Record<string, unknown>)["@_href"];
    if (typeof href === "string" && href.trim()) {
      return href.trim();
    }
  }
  return fallback;
}

function parsePublishedAt(value: unknown, fallback: Date): Date {
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return fallback;
}

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

function parseJsonFeedDocument(body: string, feedId: string, finalUrl: string): ParsedFeedDocument {
  const now = new Date();
  const parsed = JSON.parse(body) as Record<string, unknown>;
  const title = typeof parsed.title === "string" ? stripTags(parsed.title) : "Untitled";
  const description =
    typeof parsed.description === "string"
      ? stripTags(parsed.description)
      : "Follow recent articles from this feed";
  const link = absoluteHttpUrl(
    typeof parsed.home_page_url === "string" ? parsed.home_page_url : finalUrl,
    finalUrl,
  );
  const items = toArray(parsed.items).flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const record = item as Record<string, unknown>;
    const itemTitle =
      (typeof record.title === "string" && stripTags(record.title)) || `Untitled item ${index + 1}`;
    const itemLink =
      (typeof record.url === "string" && record.url.trim()) ||
      (typeof record.external_url === "string" && record.external_url.trim()) ||
      `${finalUrl}#item-${index + 1}`;
    const canonicalUrl = normalizeArticleUrl(itemLink);
    const stableIdentity = (typeof record.id === "string" && record.id.trim()) || canonicalUrl;
    const contentHtml =
      typeof record.content_html === "string" ? record.content_html.trim() || null : null;
    const contentText =
      typeof record.content_text === "string" ? record.content_text.trim() || null : null;
    const storedContent = buildStoredFeedContent(contentHtml ?? contentText);
    const imageUrl = extractImageUrl(contentHtml, itemLink);
    const publishedAt = parsePublishedAt(record.date_published, now);
    return [
      {
        id: computeFeedItemId(feedId, stableIdentity),
        stableIdentity,
        canonicalUrl,
        title: itemTitle,
        link: itemLink,
        summary:
          (typeof record.summary === "string" && summarizeText(record.summary)) ||
          summarizeText(storedContent.content),
        ...storedContent,
        imageUrl,
        publishedAt,
      },
    ];
  });

  return {
    metadata: {
      title: title || "Untitled",
      description: description || "Follow recent articles from this feed",
      link,
      iconUrl: embeddedJsonFeedIconUrl(parsed, finalUrl),
      canonicalUrl: normalizeFeedUrl(finalUrl),
    },
    items,
  };
}

function parseRssDocument(
  channel: Record<string, unknown>,
  feedId: string,
  finalUrl: string,
): ParsedFeedDocument {
  const now = new Date();
  const title = xmlText(channel.title) || "Untitled";
  const description = xmlText(channel.description) || "Follow recent articles from this feed";
  const link = absoluteHttpUrl(pickRssLink(channel.link, finalUrl), finalUrl);
  const items = toArray(channel.item).flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const record = item as Record<string, unknown>;
    const itemTitle = xmlText(record.title) || `Untitled item ${index + 1}`;
    const itemLink = pickRssLink(
      record.link,
      rawText(record.guid) ?? `${finalUrl}#item-${index + 1}`,
    );
    const canonicalUrl = normalizeArticleUrl(itemLink);
    const stableIdentity = rawText(record.guid) ?? canonicalUrl;
    const storedContent = buildStoredFeedContent(
      rawText(record["content:encoded"]) ?? rawText(record.description),
    );
    const imageUrl = extractImageUrl(
      rawText(record["content:encoded"]) ?? rawText(record.description),
      itemLink,
    );
    const summary = summarizeText(rawText(record.description) ?? storedContent.content);
    const publishedAt = parsePublishedAt(record.pubDate ?? record.isoDate, now);

    return [
      {
        id: computeFeedItemId(feedId, stableIdentity),
        stableIdentity,
        canonicalUrl,
        title: itemTitle,
        link: itemLink,
        summary,
        ...storedContent,
        imageUrl,
        publishedAt,
      },
    ];
  });

  return {
    metadata: {
      title,
      description,
      link,
      iconUrl: embeddedRssFeedIconUrl(channel, finalUrl),
      canonicalUrl: normalizeFeedUrl(finalUrl),
    },
    items,
  };
}

function parseAtomDocument(
  feed: Record<string, unknown>,
  feedId: string,
  finalUrl: string,
): ParsedFeedDocument {
  const now = new Date();
  const title = xmlText(feed.title) || "Untitled";
  const description = xmlText(feed.subtitle) || "Follow recent articles from this feed";
  const link = absoluteHttpUrl(pickAtomLink(feed.link, finalUrl), finalUrl);
  const items = toArray(feed.entry).flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }
    const record = entry as Record<string, unknown>;
    const itemTitle = xmlText(record.title) || `Untitled item ${index + 1}`;
    const itemLink = pickAtomLink(record.link, `${finalUrl}#entry-${index + 1}`);
    const canonicalUrl = normalizeArticleUrl(itemLink);
    const stableIdentity = rawText(record.id) ?? canonicalUrl;
    const storedContent = buildStoredFeedContent(
      rawText(record.content) ?? rawText(record.summary),
    );
    const imageUrl = extractImageUrl(rawText(record.content) ?? rawText(record.summary), itemLink);
    const summary = summarizeText(rawText(record.summary) ?? storedContent.content);
    const publishedAt = parsePublishedAt(record.published ?? record.updated, now);

    return [
      {
        id: computeFeedItemId(feedId, stableIdentity),
        stableIdentity,
        canonicalUrl,
        title: itemTitle,
        link: itemLink,
        summary,
        ...storedContent,
        imageUrl,
        publishedAt,
      },
    ];
  });

  return {
    metadata: {
      title,
      description,
      link,
      iconUrl: embeddedAtomFeedIconUrl(feed, finalUrl),
      canonicalUrl: normalizeFeedUrl(finalUrl),
    },
    items,
  };
}

export function parseFeedDocument(
  body: string,
  feedId: string,
  finalUrl: string,
): ParsedFeedDocument {
  const trimmed = body.trim();
  if (trimmed.startsWith("{")) {
    return parseJsonFeedDocument(trimmed, feedId, finalUrl);
  }

  const lower = trimmed.toLowerCase();
  if (lower.startsWith("<html") || lower.startsWith("<!doctype html")) {
    throw new Error("Unsupported feed format: received HTML document");
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    processEntities: FEED_XML_PROCESS_ENTITIES,
    trimValues: true,
  });
  const doc = parser.parse(trimmed) as Record<string, unknown>;

  if (doc.rss && typeof doc.rss === "object") {
    const channel = (doc.rss as Record<string, unknown>).channel;
    if (channel && typeof channel === "object") {
      return parseRssDocument(channel as Record<string, unknown>, feedId, finalUrl);
    }
  }

  if (doc.feed && typeof doc.feed === "object") {
    return parseAtomDocument(doc.feed as Record<string, unknown>, feedId, finalUrl);
  }

  throw new Error("Unsupported feed format");
}
