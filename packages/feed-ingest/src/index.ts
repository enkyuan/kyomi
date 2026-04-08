import { drizzle } from "drizzle-orm/node-postgres";
import { eq, sql } from "drizzle-orm";
// @ts-expect-error workspace runtime resolves pg correctly; package-local type resolution does not propagate here.
import { Pool } from "pg";
import { XMLParser } from "fast-xml-parser";
import { feedItems, feeds } from "@cronos/db";
import * as schema from "@cronos/db";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_ENRICHMENTS_PER_REFRESH = 5;
const ENRICHMENT_CONCURRENCY = 3;

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
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
};

type FeedMetadata = {
  title: string;
  description: string;
  link: string | null;
  canonicalUrl: string;
};

type ParsedFeedItem = {
  id: string;
  title: string;
  link: string;
  summary: string | null;
  content: string | null;
  imageUrl: string | null;
  publishedAt: Date;
};

type ParsedFeedDocument = {
  metadata: FeedMetadata;
  items: ParsedFeedItem[];
};

type FetchFeedDocumentResult =
  | { ok: true; finalUrl: string; body: string; contentType: string }
  | { ok: false; error: string };

type SearchSyncConfig = {
  url: string;
  masterKey?: string;
  indexUid?: string;
};

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
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
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

function computeFeedItemId(
  feedId: string,
  link: string,
  title: string,
  publishedAt: Date,
  ordinal: number,
): string {
  return stableUuid(`${feedId}|${link}|${title}|${publishedAt.toISOString()}|${ordinal}`);
}

async function fetchFeedDocument(url: string): Promise<FetchFeedDocumentResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept:
          "application/rss+xml, application/atom+xml, application/xml, application/json, text/xml;q=0.9, */*;q=0.8",
        "user-agent": "CronosFeedFetcher/1.0",
      },
    });

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

async function fetchArticleEnrichment(
  url: string,
): Promise<{ content: string | null; imageUrl: string | null }> {
  if (!isSafeEnrichmentUrl(url)) {
    return { content: null, imageUrl: null };
  }
  const fetched = await fetchFeedDocument(url);
  if (!fetched.ok) {
    return { content: null, imageUrl: null };
  }

  return {
    content: sanitizeStoredContent(extractReadableTextFromHtml(fetched.body)),
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
    const contentHtml =
      typeof record.content_html === "string" ? record.content_html.trim() || null : null;
    const contentText =
      typeof record.content_text === "string" ? record.content_text.trim() || null : null;
    const content = sanitizeStoredContent(contentHtml ?? contentText);
    const imageUrl = extractImageUrl(contentHtml, itemLink);
    const publishedAt = parsePublishedAt(record.date_published, now);
    return [
      {
        id: computeFeedItemId(feedId, itemLink, itemTitle, publishedAt, index),
        title: itemTitle,
        link: itemLink,
        summary:
          (typeof record.summary === "string" && summarizeText(record.summary)) ||
          summarizeText(content),
        content,
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
    const content = sanitizeStoredContent(
      rawText(record["content:encoded"]) ?? rawText(record.description),
    );
    const imageUrl = extractImageUrl(
      rawText(record["content:encoded"]) ?? rawText(record.description),
      itemLink,
    );
    const summary = summarizeText(rawText(record.description) ?? content);
    const publishedAt = parsePublishedAt(record.pubDate ?? record.isoDate, now);

    return [
      {
        id: computeFeedItemId(feedId, itemLink, itemTitle, publishedAt, index),
        title: itemTitle,
        link: itemLink,
        summary,
        content,
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
    const content = sanitizeStoredContent(rawText(record.content) ?? rawText(record.summary));
    const imageUrl = extractImageUrl(rawText(record.content) ?? rawText(record.summary), itemLink);
    const summary = summarizeText(rawText(record.summary) ?? content);
    const publishedAt = parsePublishedAt(record.published ?? record.updated, now);

    return [
      {
        id: computeFeedItemId(feedId, itemLink, itemTitle, publishedAt, index),
        title: itemTitle,
        link: itemLink,
        summary,
        content,
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

export async function runFeedRefresh(
  databaseUrl: string,
  feedId: string,
  searchSync?: SearchSyncConfig,
): Promise<FeedRefreshResult> {
  const pool = new Pool({ connectionString: databaseUrl });
  const database = drizzle(pool, { schema });

  try {
    const [feed] = await database
      .select({
        id: feeds.id,
        url: feeds.url,
      })
      .from(feeds)
      .where(eq(feeds.id, feedId))
      .limit(1);

    if (!feed) {
      return { ok: false, itemCount: 0 };
    }

    const fetched = await fetchFeedDocument(feed.url);
    if (!fetched.ok) {
      return { ok: false, itemCount: 0 };
    }

    const parsed = parseFeedDocument(fetched.body, feed.id, fetched.finalUrl);
    const now = new Date();
    const deduped = new Map<string, ParsedFeedItem>();
    for (const item of parsed.items) {
      deduped.set(item.id, item);
    }
    const items = Array.from(deduped.values());
    // TODO: add language detection once we settle on the TS-side metadata/storage model.
    const enrichmentCandidates = items
      .filter((item) => !(item.content && item.content.length >= 220 && item.imageUrl))
      .slice(0, MAX_ENRICHMENTS_PER_REFRESH);

    for (let i = 0; i < enrichmentCandidates.length; i += ENRICHMENT_CONCURRENCY) {
      const batch = enrichmentCandidates.slice(i, i + ENRICHMENT_CONCURRENCY);
      await Promise.all(
        batch.map(async (item) => {
          const enrichment = await fetchArticleEnrichment(item.link);
          if ((!item.content || item.content.length < 220) && enrichment.content) {
            item.content = enrichment.content;
            item.summary = summarizeText(enrichment.content) ?? item.summary;
          }
          if (!item.imageUrl && enrichment.imageUrl) {
            item.imageUrl = enrichment.imageUrl;
          }
        }),
      );
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
            title: item.title,
            link: item.link,
            summary: item.summary,
            content: item.content,
            imageUrl: item.imageUrl,
            publishedAt: item.publishedAt,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: feedItems.id,
          set: {
            title: sql`excluded.title`,
            link: sql`excluded.link`,
            summary: sql`excluded.summary`,
            content: sql`excluded.content`,
            imageUrl: sql`excluded.image_url`,
            publishedAt: sql`excluded.published_at`,
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
    };
  } catch {
    return {
      ok: false,
      itemCount: 0,
    };
  } finally {
    await pool.end();
  }
}
