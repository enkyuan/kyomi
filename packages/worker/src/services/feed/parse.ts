import { XMLParser } from "fast-xml-parser";
import { normalizeArticleUrl } from "../../lib/article-identity";
import { normalizeFeedUrl } from "../../lib/feed-url";
import { computeFeedItemId } from "../../lib/stable-id";
import { decodeHtmlEntities } from "../../lib/html-entities";
import {
  buildStoredFeedContent,
  extractImageUrl,
  stripTags,
  summarizeText,
} from "../../lib/feed-text";
import {
  parsePublishedAt,
  pickAtomLink,
  pickRssLink,
  rawText,
  toArray,
  xmlText,
} from "../../lib/feed-xml";
import {
  embeddedAtomFeedIconUrl,
  embeddedJsonFeedIconUrl,
  embeddedRssFeedIconUrl,
} from "./parse-icons";
import type { ParsedFeedDocument } from "./types";

function parseJsonFeedDocument(body: string, feedId: string, finalUrl: string): ParsedFeedDocument {
  const now = new Date();
  const parsed = JSON.parse(body) as Record<string, unknown>;
  const title = typeof parsed.title === "string" ? stripTags(parsed.title) : "Untitled";
  const description =
    typeof parsed.description === "string"
      ? stripTags(parsed.description)
      : "Follow recent articles from this feed";
  const link = typeof parsed.home_page_url === "string" ? parsed.home_page_url : finalUrl;
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
      link: link || null,
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
  const link = pickRssLink(channel.link, finalUrl);
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
      link: link || null,
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
  const link = pickAtomLink(feed.link, finalUrl);
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
      link: link || null,
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
    const titleMatch = trimmed.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : "Untitled";
    return {
      metadata: {
        title,
        description: "Website followed via link",
        link: finalUrl,
        iconUrl: null,
        canonicalUrl: normalizeFeedUrl(finalUrl),
      },
      items: [],
    };
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
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
