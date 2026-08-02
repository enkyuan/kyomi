import { createHash } from "node:crypto";
import { XMLParser, type X2jOptions } from "fast-xml-parser";
import { normalizeArticleUrl } from "../../lib/article-identity";
import {
  buildStoredFeedContent,
  extractImageUrl,
  stripTags,
  summarizeText,
} from "../../lib/feed-text";
import type { FeedContentLimitStats, ParsedFeedDocument, ParsedFeedItem } from "./types";

const FEED_XML_PROCESS_ENTITIES: NonNullable<X2jOptions["processEntities"]> = {
  enabled: true,
  maxEntitySize: 10_000,
  maxExpansionDepth: 10,
  maxTotalExpansions: 50_000,
  maxExpandedLength: 1_000_000,
  maxEntityCount: 100,
};
const MAX_CATEGORY_LABELS_PER_SCOPE = 20;
const MAX_CATEGORY_LABEL_LENGTH = 120;

// ponytail: kept below the plan's 5,000-feed target until large-data-read-models Task 5
// (persistFeedItems) lands; that dependency bounds SQL statement size for a 5K-item feed.
const FEED_MAX_ITEMS = 500;
const FEED_TITLE_MAX_CHARS = 1_024;
const FEED_DESCRIPTION_MAX_CHARS = 8_192;
const ITEM_TITLE_MAX_CHARS = 1_024;
const ITEM_SOURCE_CONTENT_MAX_BYTES = 256 * 1024;
const FEED_ACCEPTED_CONTENT_MAX_BYTES = 4 * 1024 * 1024;

function utf8ByteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function clampChars(value: string, maxChars: number): string {
  return value.length > maxChars ? value.slice(0, maxChars) : value;
}

class ContentLimitTracker {
  sourceItemCount = 0;
  acceptedItemCount = 0;
  contentCandidateCount = 0;
  droppedContentItemCount = 0;
  acceptedContentBytes = 0;

  admitItem(): boolean {
    this.sourceItemCount += 1;
    if (this.acceptedItemCount >= FEED_MAX_ITEMS) {
      return false;
    }
    this.acceptedItemCount += 1;
    return true;
  }

  /** Returns the candidate body if it fits under the per-item and aggregate budgets, else null. */
  admitContent(candidate: string | null): string | null {
    if (!candidate) {
      return null;
    }
    this.contentCandidateCount += 1;
    const byteLength = utf8ByteLength(candidate);
    if (
      byteLength > ITEM_SOURCE_CONTENT_MAX_BYTES ||
      this.acceptedContentBytes + byteLength > FEED_ACCEPTED_CONTENT_MAX_BYTES
    ) {
      this.droppedContentItemCount += 1;
      return null;
    }
    this.acceptedContentBytes += byteLength;
    return candidate;
  }

  finish(): FeedContentLimitStats {
    return {
      sourceItemCount: this.sourceItemCount,
      acceptedItemCount: this.acceptedItemCount,
      droppedItemCount: this.sourceItemCount - this.acceptedItemCount,
      contentCandidateCount: this.contentCandidateCount,
      droppedContentItemCount: this.droppedContentItemCount,
      acceptedContentBytes: this.acceptedContentBytes,
    };
  }
}

/**
 * A body dropped for size still needs a summary fallback, so derive it from at most the
 * first 256 KiB of source text rather than the (possibly much larger) rejected candidate.
 */
function boundedSummarySource(candidate: string | null): string | null {
  if (!candidate) {
    return null;
  }
  if (utf8ByteLength(candidate) <= ITEM_SOURCE_CONTENT_MAX_BYTES) {
    return candidate;
  }
  return Buffer.from(candidate, "utf8").subarray(0, ITEM_SOURCE_CONTENT_MAX_BYTES).toString("utf8");
}

function stableUuid(seed: string): string {
  const digest = createHash("sha256").update(seed).digest();
  const bytes = digest.subarray(0, 16);

  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function computeFeedItemId(feedId: string, canonicalUrl: string): string {
  return stableUuid(`${feedId}|${canonicalUrl}`);
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

function normalizeCategoryLabel(value: string): string | null {
  const normalized = stripTags(value).replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }
  return normalized.length > MAX_CATEGORY_LABEL_LENGTH
    ? normalized.slice(0, MAX_CATEGORY_LABEL_LENGTH).trim()
    : normalized;
}

function collectCategoryLabels(value: unknown, labels: string[]): void {
  for (const candidate of toArray(value)) {
    if (typeof candidate === "string") {
      const label = normalizeCategoryLabel(candidate);
      if (label) {
        labels.push(label);
      }
      continue;
    }
    if (!candidate || typeof candidate !== "object") {
      continue;
    }

    const record = candidate as Record<string, unknown>;
    for (const key of ["#text", "@_text", "@_label", "@_term"]) {
      const raw = record[key];
      if (typeof raw === "string") {
        const label = normalizeCategoryLabel(raw);
        if (label) {
          labels.push(label);
        }
      }
    }
    collectCategoryLabels(record["itunes:category"], labels);
    collectCategoryLabels(record.category, labels);
  }
}

function dedupeCategoryLabels(labels: string[]): string[] {
  const seen = new Set<string>();
  return labels.filter((label) => {
    const key = label.toLocaleLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function categoryLabelsFrom(...values: unknown[]): string[] {
  const labels: string[] = [];
  for (const value of values) {
    collectCategoryLabels(value, labels);
  }

  return dedupeCategoryLabels(labels).slice(0, MAX_CATEGORY_LABELS_PER_SCOPE);
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

function jsonFeedTagLabels(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const labels: string[] = [];
  for (const tag of value) {
    if (typeof tag !== "string") {
      continue;
    }
    const label = normalizeCategoryLabel(tag);
    if (label) {
      labels.push(label);
    }
  }
  return dedupeCategoryLabels(labels);
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
  const tracker = new ContentLimitTracker();
  const items: ParsedFeedItem[] = [];
  for (const [index, item] of toArray(parsed.items).entries()) {
    if (!item || typeof item !== "object") {
      continue;
    }
    if (!tracker.admitItem()) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const itemTitle = clampChars(
      (typeof record.title === "string" && stripTags(record.title)) || `Untitled item ${index + 1}`,
      ITEM_TITLE_MAX_CHARS,
    );
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
    const rawCandidate = contentHtml ?? contentText;
    const storedContent = buildStoredFeedContent(tracker.admitContent(rawCandidate));
    const imageUrl = extractImageUrl(contentHtml, itemLink);
    const publishedAt = parsePublishedAt(record.date_published, now);
    items.push({
      id: computeFeedItemId(feedId, canonicalUrl),
      stableIdentity,
      canonicalUrl,
      title: itemTitle,
      link: itemLink,
      summary:
        (typeof record.summary === "string" && summarizeText(record.summary)) ||
        summarizeText(storedContent.content ?? boundedSummarySource(rawCandidate)),
      ...storedContent,
      imageUrl,
      publishedAt,
      categoryLabels: jsonFeedTagLabels(record.tags).slice(0, MAX_CATEGORY_LABELS_PER_SCOPE),
    });
  }

  return {
    metadata: {
      title: clampChars(title || "Untitled", FEED_TITLE_MAX_CHARS),
      description: clampChars(
        description || "Follow recent articles from this feed",
        FEED_DESCRIPTION_MAX_CHARS,
      ),
      link,
      iconUrl: embeddedJsonFeedIconUrl(parsed, finalUrl),
      canonicalUrl: normalizeFeedUrl(finalUrl),
      categoryLabels: jsonFeedTagLabels(parsed.tags).slice(0, MAX_CATEGORY_LABELS_PER_SCOPE),
    },
    items,
    contentLimitStats: tracker.finish(),
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
  const tracker = new ContentLimitTracker();
  const items: ParsedFeedItem[] = [];
  for (const [index, item] of toArray(channel.item).entries()) {
    if (!item || typeof item !== "object") {
      continue;
    }
    if (!tracker.admitItem()) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const itemTitle = clampChars(
      xmlText(record.title) || `Untitled item ${index + 1}`,
      ITEM_TITLE_MAX_CHARS,
    );
    const itemLink = pickRssLink(
      record.link,
      rawText(record.guid) ?? `${finalUrl}#item-${index + 1}`,
    );
    const canonicalUrl = normalizeArticleUrl(itemLink);
    const stableIdentity = rawText(record.guid) ?? canonicalUrl;
    const rawCandidate = rawText(record["content:encoded"]) ?? rawText(record.description);
    const storedContent = buildStoredFeedContent(tracker.admitContent(rawCandidate));
    const imageUrl = extractImageUrl(
      rawText(record["content:encoded"]) ?? rawText(record.description),
      itemLink,
    );
    const summary = summarizeText(
      rawText(record.description) ?? storedContent.content ?? boundedSummarySource(rawCandidate),
    );
    const publishedAt = parsePublishedAt(record.pubDate ?? record.isoDate, now);
    const categoryLabels = categoryLabelsFrom(record.category, record["itunes:category"]);

    items.push({
      id: computeFeedItemId(feedId, canonicalUrl),
      stableIdentity,
      canonicalUrl,
      title: itemTitle,
      link: itemLink,
      summary,
      ...storedContent,
      imageUrl,
      publishedAt,
      categoryLabels,
    });
  }

  return {
    metadata: {
      title: clampChars(title, FEED_TITLE_MAX_CHARS),
      description: clampChars(description, FEED_DESCRIPTION_MAX_CHARS),
      link,
      iconUrl: embeddedRssFeedIconUrl(channel, finalUrl),
      canonicalUrl: normalizeFeedUrl(finalUrl),
      categoryLabels: categoryLabelsFrom(channel.category, channel["itunes:category"]),
    },
    items,
    contentLimitStats: tracker.finish(),
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
  const tracker = new ContentLimitTracker();
  const items: ParsedFeedItem[] = [];
  for (const [index, entry] of toArray(feed.entry).entries()) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    if (!tracker.admitItem()) {
      continue;
    }
    const record = entry as Record<string, unknown>;
    const itemTitle = clampChars(
      xmlText(record.title) || `Untitled item ${index + 1}`,
      ITEM_TITLE_MAX_CHARS,
    );
    const itemLink = pickAtomLink(record.link, `${finalUrl}#entry-${index + 1}`);
    const canonicalUrl = normalizeArticleUrl(itemLink);
    const stableIdentity = rawText(record.id) ?? canonicalUrl;
    const rawCandidate = rawText(record.content) ?? rawText(record.summary);
    const storedContent = buildStoredFeedContent(tracker.admitContent(rawCandidate));
    const imageUrl = extractImageUrl(rawText(record.content) ?? rawText(record.summary), itemLink);
    const summary = summarizeText(
      rawText(record.summary) ?? storedContent.content ?? boundedSummarySource(rawCandidate),
    );
    const publishedAt = parsePublishedAt(record.published ?? record.updated, now);
    const categoryLabels = categoryLabelsFrom(record.category);

    items.push({
      id: computeFeedItemId(feedId, canonicalUrl),
      stableIdentity,
      canonicalUrl,
      title: itemTitle,
      link: itemLink,
      summary,
      ...storedContent,
      imageUrl,
      publishedAt,
      categoryLabels,
    });
  }

  return {
    metadata: {
      title: clampChars(title, FEED_TITLE_MAX_CHARS),
      description: clampChars(description, FEED_DESCRIPTION_MAX_CHARS),
      link,
      iconUrl: embeddedAtomFeedIconUrl(feed, finalUrl),
      canonicalUrl: normalizeFeedUrl(finalUrl),
      categoryLabels: categoryLabelsFrom(feed.category),
    },
    items,
    contentLimitStats: tracker.finish(),
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
