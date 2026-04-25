import { resolveFeedFaviconUrl } from "@cronos/favicon";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
import { XMLParser } from "fast-xml-parser";
import { feedItems, feeds } from "@cronos/db";
import * as schema from "@cronos/db";
import { normalizeArticleUrl } from "./article-identity";

export { buildArticleIdentity, normalizeArticleUrl } from "./article-identity";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ENRICHMENTS_PER_REFRESH = 5;
const ENRICHMENT_CONCURRENCY = 3;

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^::$/,
  /^::ffff:/i,
  /^fc00:/i,
  /^fe80:/i,
  /^localhost$/i,
];

function isSafeEnrichmentUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }
  const hostname = url.hostname.replace(/^\[/, "").replace(/\]$/, "");
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return false;
    }
  }
  return true;
}

export type FeedRefreshResult = {
  ok: boolean;
  itemCount: number;
  insertedCount?: number;
  updatedCount?: number;
  notModified?: boolean;
  error?: string;
};

export type FeedIngestDatabase = ReturnType<typeof drizzle<typeof schema>>;

type FeedMetadata = {
  title: string;
  description: string;
  link: string | null;
  canonicalUrl: string;
};

type ParsedFeedItem = {
  id: string;
  stableIdentity: string;
  canonicalUrl: string;
  title: string;
  link: string;
  summary: string | null;
  content: string | null;
  contentHtml: string | null;
  contentText: string | null;
  contentMarkdown: string | null;
  contentStatus: "ready" | "partial" | "failed" | "pending";
  contentSource:
    | "feed_html"
    | "feed_markdown"
    | "feed_summary"
    | "extracted_html"
    | "text_fallback"
    | "link_only";
  extractionErrorCode: string | null;
  extractionErrorMessage: string | null;
  imageUrl: string | null;
  publishedAt: Date;
};

type ParsedFeedDocument = {
  metadata: FeedMetadata;
  items: ParsedFeedItem[];
};

type FetchFeedDocumentResult =
  | {
      ok: true;
      finalUrl: string;
      body: string;
      contentType: string;
      etag: string | null;
      lastModified: string | null;
      notModified: false;
    }
  | {
      ok: true;
      notModified: true;
      etag: string | null;
      lastModified: string | null;
    }
  | { ok: false; error: string };

type SearchSyncConfig = {
  url: string;
  masterKey?: string;
  indexUid?: string;
};

type RefreshTimingSnapshot = {
  lastRefreshSucceededAt: Date | null;
  lastRefreshFailedAt: Date | null;
};

function computeFailureBackoffMs(snapshot: RefreshTimingSnapshot): number {
  const hasConsecutiveFailure =
    Boolean(snapshot.lastRefreshFailedAt) &&
    (!snapshot.lastRefreshSucceededAt ||
      snapshot.lastRefreshFailedAt!.getTime() >= snapshot.lastRefreshSucceededAt.getTime());
  return hasConsecutiveFailure ? 60 * 60 * 1000 : 15 * 60 * 1000;
}

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  copy: "©",
  reg: "®",
  trade: "™",
};

function decodeCodePoint(value: number, fallback: string): string {
  try {
    return String.fromCodePoint(value);
  } catch {
    return fallback;
  }
}

export function decodeHtmlEntities(value: string): string {
  let decoded = value;

  for (let pass = 0; pass < 2; pass += 1) {
    const next = decoded.replace(
      /&(?:#(\d+)|#x([\da-fA-F]+)|([a-zA-Z][\w]+));/g,
      (_match, decimal, hexadecimal, named) => {
        if (decimal) {
          const codePoint = Number.parseInt(decimal, 10);
          return Number.isFinite(codePoint) ? decodeCodePoint(codePoint, _match) : _match;
        }

        if (hexadecimal) {
          const codePoint = Number.parseInt(hexadecimal, 16);
          return Number.isFinite(codePoint) ? decodeCodePoint(codePoint, _match) : _match;
        }

        if (named) {
          return NAMED_HTML_ENTITIES[named] ?? _match;
        }

        return _match;
      },
    );

    if (next === decoded) {
      break;
    }
    decoded = next;
  }

  return decoded;
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

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function sanitizeStoredContent(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const sanitized = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .trim();
  return sanitized || null;
}

function looksLikeHtml(value: string | null): boolean {
  return Boolean(value && /<[a-z][\s\S]*>/i.test(value));
}

function markdownSignalScore(value: string): number {
  let score = 0;
  if (/(^|\n)\s*```[\w-]*\n[\s\S]*?\n\s*```/m.test(value)) score += 7;
  if (/(^|\n)\s{0,3}(?:[-*+]\s+|\d+[.)]\s+)/m.test(value)) score += 4;
  if (/(^|\n)\s{0,3}>[^\n]+/m.test(value)) score += 3;
  if (/(^|\n)\s{0,3}#{1,6}\s+\S/m.test(value)) score += 4;
  if (/(^|\n)[^\n]+\n(?:=+|-{3,})\s*($|\n)/m.test(value)) score += 4;
  if (/(^|\n)\s*\|.+\|\s*\n\s*\|[-:\s|]+\|/m.test(value)) score += 6;
  if (/\[[^\]]+\]\(([^)\s]+)(?:\s+"[^"]*")?\)/m.test(value)) score += 4;
  if (/!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/m.test(value)) score += 4;
  if (/`[^`\n]{1,140}`/.test(value)) score += 3;
  if (/(^|\n)\s*[-*_]{3,}\s*($|\n)/m.test(value)) score += 2;
  return score;
}

function looksLikeMarkdown(value: string | null): boolean {
  if (!value) {
    return false;
  }
  const score = markdownSignalScore(value);
  const hasHeading = /(^|\n)\s{0,3}#{1,6}\s+\S/m.test(value);
  const hasSetextHeading = /(^|\n)[^\n]+\n(?:=+|-{3,})\s*($|\n)/m.test(value);
  const hasList = /(^|\n)\s{0,3}(?:[-*+]\s+|\d+[.)]\s+)/m.test(value);
  const hasRule = /(^|\n)\s*[-*_]{3,}\s*($|\n)/m.test(value);

  if (score >= 6) {
    return true;
  }
  if (value.length > 1800 && score >= 4 && (hasHeading || hasSetextHeading || hasList || hasRule)) {
    return true;
  }
  return score >= 3 && value.length <= 2600;
}

function htmlLooksLikeWrappedMarkdown(value: string): boolean {
  return !/<(h[1-6]|ul|ol|li|blockquote|pre|table|thead|tbody|tr|th|td|hr|code)\b/i.test(value);
}

function buildStoredFeedContent(
  value: string | null,
): Pick<
  ParsedFeedItem,
  | "content"
  | "contentHtml"
  | "contentText"
  | "contentMarkdown"
  | "contentStatus"
  | "contentSource"
  | "extractionErrorCode"
  | "extractionErrorMessage"
> {
  const sanitized = sanitizeStoredContent(value);
  if (!sanitized) {
    return {
      content: null,
      contentHtml: null,
      contentText: null,
      contentMarkdown: null,
      contentStatus: "pending",
      contentSource: "link_only",
      extractionErrorCode: null,
      extractionErrorMessage: null,
    };
  }

  if (looksLikeHtml(sanitized)) {
    const htmlText = stripTags(sanitized);
    if (looksLikeMarkdown(htmlText) && htmlLooksLikeWrappedMarkdown(sanitized)) {
      return {
        content: sanitized,
        contentHtml: null,
        contentText: htmlText,
        contentMarkdown: htmlText,
        contentStatus: "ready",
        contentSource: "feed_markdown",
        extractionErrorCode: null,
        extractionErrorMessage: null,
      };
    }
    return {
      content: sanitized,
      contentHtml: sanitized,
      contentText: stripTags(sanitized),
      contentMarkdown: null,
      contentStatus: "ready",
      contentSource: "feed_html",
      extractionErrorCode: null,
      extractionErrorMessage: null,
    };
  }

  if (looksLikeMarkdown(sanitized)) {
    return {
      content: sanitized,
      contentHtml: null,
      contentText: sanitized,
      contentMarkdown: sanitized,
      contentStatus: "ready",
      contentSource: "feed_markdown",
      extractionErrorCode: null,
      extractionErrorMessage: null,
    };
  }

  return {
    content: sanitized,
    contentHtml: null,
    contentText: sanitized,
    contentMarkdown: null,
    contentStatus: "partial",
    contentSource: "text_fallback",
    extractionErrorCode: null,
    extractionErrorMessage: null,
  };
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

function firstMatch(input: string, pattern: RegExp): string | null {
  const match = input.match(pattern);
  return match?.[1]?.trim() || null;
}

function extractImageUrl(html: string | null, baseUrl: string): string | null {
  if (!html) {
    return null;
  }
  return (
    absoluteUrl(
      firstMatch(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
        firstMatch(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ??
        firstMatch(html, /<img[^>]+src=["']([^"']+)["']/i),
      baseUrl,
    ) ?? null
  );
}

function extractReadableTextFromHtml(html: string): string | null {
  const articleSection =
    firstMatch(html, /<article[^>]*>([\s\S]*?)<\/article>/i) ??
    firstMatch(html, /<main[^>]*>([\s\S]*?)<\/main>/i) ??
    firstMatch(html, /<body[^>]*>([\s\S]*?)<\/body>/i) ??
    html;
  const text = stripTags(articleSection);
  return text || null;
}

function summarizeText(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const plain = stripTags(value);
  if (!plain) {
    return null;
  }
  return plain.length > 280 ? `${plain.slice(0, 277)}...` : plain;
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

async function fetchFeedDocument(
  url: string,
  etag?: string | null,
  lastModified?: string | null,
): Promise<FetchFeedDocumentResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      accept:
        "application/rss+xml, application/atom+xml, application/xml, application/json, text/xml;q=0.9, */*;q=0.8",
      "user-agent": "CronosFeedFetcher/1.0",
    };
    if (etag) headers["if-none-match"] = etag;
    if (lastModified) headers["if-modified-since"] = lastModified;

    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers,
    });

    if (response.status === 304) {
      return {
        ok: true,
        notModified: true,
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
      };
    }

    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return { ok: false, error: "Feed response too large" };
    }

    return {
      ok: true,
      finalUrl: response.url,
      body: new TextDecoder("utf-8", { fatal: false }).decode(buffer),
      contentType: response.headers.get("content-type") ?? "",
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
      notModified: false,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "fetch failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchArticleEnrichment(url: string): Promise<{
  content: string | null;
  contentHtml: string | null;
  contentText: string | null;
  contentStatus: ParsedFeedItem["contentStatus"];
  contentSource: ParsedFeedItem["contentSource"];
  extractionErrorCode: string | null;
  extractionErrorMessage: string | null;
  imageUrl: string | null;
}> {
  if (!isSafeEnrichmentUrl(url)) {
    return {
      content: null,
      contentHtml: null,
      contentText: null,
      contentStatus: "failed",
      contentSource: "link_only",
      extractionErrorCode: "BLOCKED_URL",
      extractionErrorMessage: "Invalid or unsafe URL provided.",
      imageUrl: null,
    };
  }
  const fetched = await fetchFeedDocument(url);
  if (!fetched.ok) {
    return {
      content: null,
      contentHtml: null,
      contentText: null,
      contentStatus: "failed",
      contentSource: "link_only",
      extractionErrorCode: "FETCH_FAILED",
      extractionErrorMessage: fetched.error,
      imageUrl: null,
    };
  }
  if (fetched.notModified) {
    return {
      content: null,
      contentHtml: null,
      contentText: null,
      contentStatus: "failed",
      contentSource: "link_only",
      extractionErrorCode: "FETCH_NOT_MODIFIED",
      extractionErrorMessage: "Unexpected 304 Not Modified for enrichment",
      imageUrl: null,
    };
  }

  const contentText = sanitizeStoredContent(extractReadableTextFromHtml(fetched.body));

  return {
    content: contentText,
    contentHtml: null,
    contentText,
    contentStatus: contentText ? "partial" : "failed",
    contentSource: contentText ? "text_fallback" : "link_only",
    extractionErrorCode: null,
    extractionErrorMessage: null,
    imageUrl: extractImageUrl(fetched.body, fetched.finalUrl),
  };
}

async function syncFeedToSearch(
  config: SearchSyncConfig | undefined,
  document: FeedMetadata & { id: string },
): Promise<void> {
  if (!config?.url) {
    return;
  }

  const baseUrl = config.url.replace(/\/+$/, "");
  const indexUid = config.indexUid?.trim() || "feeds";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.masterKey) {
    headers.Authorization = `Bearer ${config.masterKey}`;
  }

  const createResponse = await fetch(`${baseUrl}/indexes`, {
    method: "POST",
    headers,
    body: JSON.stringify({ uid: indexUid, primaryKey: "id" }),
  }).catch((error: unknown) => {
    console.warn("[syncFeedToSearch] index creation request failed:", error);
    return null;
  });

  if (createResponse && !createResponse.ok && createResponse.status !== 409) {
    console.warn(`[syncFeedToSearch] index creation returned ${createResponse.status}`);
  }

  const upsertResponse = await fetch(`${baseUrl}/indexes/${indexUid}/documents`, {
    method: "POST",
    headers,
    body: JSON.stringify([
      {
        id: document.id,
        url: document.canonicalUrl,
        title: document.title,
        description: document.description,
        link: document.link,
      },
    ]),
  }).catch((error: unknown) => {
    console.warn("[syncFeedToSearch] document upsert request failed:", error);
    return null;
  });

  if (upsertResponse && !upsertResponse.ok) {
    console.warn(`[syncFeedToSearch] document upsert returned ${upsertResponse.status}`);
  }
}

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

async function tryResolveFaviconMetadata(seedUrl: string): Promise<{
  url: string;
  source: string;
} | null> {
  try {
    return await resolveFeedFaviconUrl(seedUrl);
  } catch (error) {
    console.warn("[ingestion] favicon resolution failed", {
      seedUrl,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function runFeedRefresh(
  database: FeedIngestDatabase,
  feedId: string,
  searchSync?: SearchSyncConfig,
  options?: {
    enrichArticles?: boolean;
  },
): Promise<FeedRefreshResult> {
  try {
    const startedAt = new Date();
    await database
      .update(feeds)
      .set({
        refreshStatus: "running",
        lastRefreshStartedAt: startedAt,
        lastRefreshError: null,
      })
      .where(eq(feeds.id, feedId));

    const [feed] = await database
      .select({
        id: feeds.id,
        url: feeds.url,
        link: feeds.link,
        faviconUrl: feeds.faviconUrl,
        etag: feeds.etag,
        lastModified: feeds.lastModified,
        lastRefreshSucceededAt: feeds.lastRefreshSucceededAt,
        lastRefreshFailedAt: feeds.lastRefreshFailedAt,
      })
      .from(feeds)
      .where(eq(feeds.id, feedId))
      .limit(1);

    if (!feed) {
      return { ok: false, itemCount: 0, error: "Feed not found" };
    }

    const fetched = await fetchFeedDocument(feed.url, feed.etag, feed.lastModified);
    if (!fetched.ok) {
      const now = new Date();
      const backoffMs = computeFailureBackoffMs({
        lastRefreshSucceededAt: feed.lastRefreshSucceededAt,
        lastRefreshFailedAt: feed.lastRefreshFailedAt,
      });
      await database
        .update(feeds)
        .set({
          refreshStatus: "failed",
          lastRefreshFailedAt: now,
          lastRefreshError: fetched.error,
          lastRefreshCompletedAt: now,
          nextRefreshAt: new Date(now.getTime() + backoffMs),
        })
        .where(eq(feeds.id, feedId));
      return { ok: false, itemCount: 0, error: `Feed fetch failed: ${fetched.error}` };
    }

    if (fetched.notModified) {
      const now = new Date();
      let faviconPatch: {
        faviconUrl: string;
        faviconSource: string;
        faviconFetchedAt: Date;
        updatedAt: Date;
      } | null = null;
      if (!feed.faviconUrl) {
        const seed = feed.link ?? feed.url;
        const resolved = await tryResolveFaviconMetadata(seed);
        if (resolved) {
          faviconPatch = {
            faviconUrl: resolved.url,
            faviconSource: resolved.source,
            faviconFetchedAt: now,
            updatedAt: now,
          };
        }
      }
      await database
        .update(feeds)
        .set({
          refreshStatus: "idle",
          lastRefreshCompletedAt: now,
          lastRefreshSucceededAt: now,
          lastRefreshError: null,
          etag: fetched.etag ?? feed.etag,
          lastModified: fetched.lastModified ?? feed.lastModified,
          nextRefreshAt: new Date(now.getTime() + 60 * 60 * 1000), // Next refresh in 1 hour
          ...(faviconPatch ?? {}),
        })
        .where(eq(feeds.id, feedId));
      return { ok: true, itemCount: 0, notModified: true };
    }

    const parsed = parseFeedDocument(fetched.body, feed.id, fetched.finalUrl);
    const now = new Date();
    const deduped = new Map<string, ParsedFeedItem>();
    for (const item of parsed.items) {
      deduped.set(item.canonicalUrl, item);
    }
    const items = Array.from(deduped.values());
    // TODO: add language detection once we settle on the TS-side metadata/storage model.
    const enrichArticles = options?.enrichArticles ?? true;
    if (enrichArticles) {
      const enrichmentCandidates = items
        .filter((item) => !(item.contentText && item.contentText.length >= 220 && item.imageUrl))
        .slice(0, MAX_ENRICHMENTS_PER_REFRESH);

      for (let i = 0; i < enrichmentCandidates.length; i += ENRICHMENT_CONCURRENCY) {
        const batch = enrichmentCandidates.slice(i, i + ENRICHMENT_CONCURRENCY);
        await Promise.all(
          batch.map(async (item) => {
            const enrichment = await fetchArticleEnrichment(item.link);
            if ((!item.contentText || item.contentText.length < 220) && enrichment.content) {
              item.content = enrichment.content;
              item.contentHtml = enrichment.contentHtml;
              item.contentText = enrichment.contentText ?? enrichment.content;
              item.contentStatus = enrichment.contentStatus;
              item.contentSource = enrichment.contentSource;
              item.extractionErrorCode = enrichment.extractionErrorCode;
              item.extractionErrorMessage = enrichment.extractionErrorMessage;
              item.summary =
                summarizeText(enrichment.contentText ?? enrichment.content) ?? item.summary;
            }
            if (!item.imageUrl && enrichment.imageUrl) {
              item.imageUrl = enrichment.imageUrl;
            }
          }),
        );
      }
    }

    const prevLink = feed.link ?? null;
    const nextLink = parsed.metadata.link ?? null;
    const linkChanged = (prevLink ?? "") !== (nextLink ?? "");
    const needsFavicon = !feed.faviconUrl || linkChanged;
    let faviconPatch: {
      faviconUrl: string;
      faviconSource: string;
      faviconFetchedAt: Date;
    } | null = null;
    if (needsFavicon) {
      const seed = nextLink ?? parsed.metadata.canonicalUrl;
      const resolved = await tryResolveFaviconMetadata(seed);
      if (resolved) {
        faviconPatch = {
          faviconUrl: resolved.url,
          faviconSource: resolved.source,
          faviconFetchedAt: now,
        };
      }
    }

    await database.transaction(async (tx) => {
      await tx
        .update(feeds)
        .set({
          url: parsed.metadata.canonicalUrl,
          title: parsed.metadata.title,
          description: parsed.metadata.description,
          link: parsed.metadata.link,
          updatedAt: now,
          refreshStatus: "idle",
          lastRefreshCompletedAt: now,
          lastRefreshSucceededAt: now,
          lastRefreshError: null,
          etag: fetched.etag,
          lastModified: fetched.lastModified,
          nextRefreshAt: new Date(now.getTime() + 60 * 60 * 1000),
          ...(faviconPatch ?? {}),
        })
        .where(eq(feeds.id, feed.id));

      if (items.length === 0) {
        return;
      }

      await tx
        .insert(feedItems)
        .values(
          items.map((item) => ({
            id: item.id,
            feedId: feed.id,
            canonicalUrl: item.canonicalUrl,
            title: item.title,
            link: item.link,
            summary: item.summary,
            content: item.content,
            contentHtml: item.contentHtml,
            contentText: item.contentText,
            contentMarkdown: item.contentMarkdown,
            contentStatus: item.contentStatus,
            contentSource: item.contentSource,
            extractionErrorCode: item.extractionErrorCode,
            extractionErrorMessage: item.extractionErrorMessage,
            imageUrl: item.imageUrl,
            publishedAt: item.publishedAt,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [feedItems.feedId, feedItems.canonicalUrl],
          set: {
            title: sql`CASE WHEN length(trim(excluded.title)) > length(trim(${feedItems.title})) THEN excluded.title ELSE ${feedItems.title} END`,
            link: sql`COALESCE(NULLIF(${feedItems.link}, ''), excluded.link)`,
            summary: sql`CASE WHEN length(COALESCE(excluded.summary, '')) > length(COALESCE(${feedItems.summary}, '')) THEN excluded.summary ELSE ${feedItems.summary} END`,
            content: sql`COALESCE(${feedItems.content}, excluded.content)`,
            contentHtml: sql`COALESCE(${feedItems.contentHtml}, excluded.content_html)`,
            contentText: sql`COALESCE(${feedItems.contentText}, excluded.content_text)`,
            contentMarkdown: sql`COALESCE(${feedItems.contentMarkdown}, excluded.content_markdown)`,
            contentStatus: sql`CASE WHEN ${feedItems.content} IS NULL AND excluded.content IS NOT NULL THEN excluded.content_status ELSE ${feedItems.contentStatus} END`,
            contentSource: sql`CASE WHEN ${feedItems.content} IS NULL AND excluded.content IS NOT NULL THEN excluded.content_source ELSE ${feedItems.contentSource} END`,
            extractionErrorCode: sql`COALESCE(${feedItems.extractionErrorCode}, excluded.extraction_error_code)`,
            extractionErrorMessage: sql`COALESCE(${feedItems.extractionErrorMessage}, excluded.extraction_error_message)`,
            imageUrl: sql`COALESCE(${feedItems.imageUrl}, excluded.image_url)`,
            publishedAt: sql`LEAST(${feedItems.publishedAt}, excluded.published_at)`,
            updatedAt: now,
          },
        });
    });

    await syncFeedToSearch(searchSync, {
      id: feed.id,
      ...parsed.metadata,
    });

    return {
      ok: true,
      itemCount: items.length,
      insertedCount: items.length, // Rough estimate as we don't have exact UPSERT counts right now
    };
  } catch (error) {
    let message = "Feed refresh failed";
    if (error instanceof Error) {
      const cause = (error as Error & { cause?: unknown }).cause;
      message = cause instanceof Error ? cause.message : error.message;
    }
    const now = new Date();
    const backoffMs = 30 * 60 * 1000;
    await database
      .update(feeds)
      .set({
        refreshStatus: "failed",
        lastRefreshFailedAt: now,
        lastRefreshError: message,
        lastRefreshCompletedAt: now,
        nextRefreshAt: new Date(now.getTime() + backoffMs),
      })
      .where(eq(feeds.id, feedId))
      .catch(() => {});

    return {
      ok: false,
      itemCount: 0,
      error: message,
    };
  }
}
