import { decodeHtmlEntities } from "../lib/html-entities";

export const SNAPSHOT_PROVIDERS = ["x", "bluesky", "mastodon", "threads", "instagram"] as const;
export type SnapshotProvider = (typeof SNAPSHOT_PROVIDERS)[number];

export function isSnapshotProvider(value: string): value is SnapshotProvider {
  return (SNAPSHOT_PROVIDERS as readonly string[]).includes(value);
}

type SnapshotImage = { src: string; alt: string; width?: number; height?: number };

/** Shape of `embed.snapshot` in `packages/reader/src/core/document/media.ts`. */
export type EmbedSnapshot = {
  text?: { type: "text"; value: string }[];
  author?: { name: string; handle?: string; url?: string; avatar?: SnapshotImage };
  publishedAt?: string;
  thumbnail?: SnapshotImage;
  media?: SnapshotImage[];
  fetchedAt: string;
};

export type SnapshotRequest = { url: string; accept: string };

const MAX_TEXT_LENGTH = 4_000;
const MAX_MEDIA = 4;
const JSON_ACCEPT = "application/json";
const HTML_ACCEPT = "text/html,application/xhtml+xml;q=0.9";

type Json = Record<string, unknown>;

function asObject(value: unknown): Json | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function positiveInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function httpUrl(value: unknown): string | undefined {
  const raw = str(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function image(
  src: unknown,
  alt: unknown,
  width?: unknown,
  height?: unknown,
): SnapshotImage | undefined {
  const url = httpUrl(src);
  if (!url) return undefined;
  const w = positiveInt(width);
  const h = positiveInt(height);
  return { src: url, alt: str(alt) ?? "", ...(w && h ? { width: w, height: h } : {}) };
}

function isoDate(value: unknown): string | undefined {
  const raw = str(value);
  if (!raw) return undefined;
  const time = Date.parse(raw);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

function plainText(value: string | undefined): { type: "text"; value: string }[] | undefined {
  const text = value?.replace(/\r\n?/g, "\n").trim().slice(0, MAX_TEXT_LENGTH);
  return text ? [{ type: "text", value: text }] : undefined;
}

/** Converts a small HTML fragment to text, keeping paragraph and line breaks. */
export function htmlFragmentToText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]*>/g, "");
  return decodeHtmlEntities(withBreaks).trim();
}

function meta(html: string, property: string): string | undefined {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const key = /\s(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1];
    if (key?.toLowerCase() !== property) continue;
    const content = /\scontent\s*=\s*"([^"]*)"|\scontent\s*=\s*'([^']*)'/i.exec(tag);
    const value = content?.[1] ?? content?.[2];
    if (value) return decodeHtmlEntities(value);
  }
  return undefined;
}

/** The public endpoint to fetch for an embed, or null when the URL is not a post. */
export function snapshotRequest(
  provider: SnapshotProvider,
  embedUrl: string,
): SnapshotRequest | null {
  let url: URL;
  try {
    url = new URL(embedUrl);
  } catch {
    return null;
  }
  switch (provider) {
    case "x":
      return {
        url: `https://publish.twitter.com/oembed?omit_script=true&dnt=true&url=${encodeURIComponent(url.href)}`,
        accept: JSON_ACCEPT,
      };
    case "bluesky": {
      const match = url.pathname.match(/^\/profile\/([^/]+)\/post\/([A-Za-z0-9]+)\/?$/);
      if (!match) return null;
      const uri = `at://${match[1]}/app.bsky.feed.post/${match[2]}`;
      return {
        url: `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?depth=0&parentHeight=0&uri=${encodeURIComponent(uri)}`,
        accept: JSON_ACCEPT,
      };
    }
    case "mastodon": {
      const match = url.pathname.match(/^\/(?:@[^/]+|users\/[^/]+\/statuses)\/(\d+)\/?$/);
      if (!match || url.protocol !== "https:") return null;
      return { url: `https://${url.host}/api/v1/statuses/${match[1]}`, accept: JSON_ACCEPT };
    }
    case "threads":
    case "instagram":
      return { url: url.href, accept: HTML_ACCEPT };
  }
}

function parseBluesky(body: string, fetchedAt: string): EmbedSnapshot | null {
  const post = asObject(asObject(asObject(JSON.parse(body))?.thread)?.post);
  const record = asObject(post?.record);
  const author = asObject(post?.author);
  if (!post || !record || !author) return null;

  const embed = asObject(post.embed);
  const media = asObject(embed?.media);
  const images = [embed?.images, media?.images].find(Array.isArray) as unknown[] | undefined;
  const mediaImages = (images ?? []).flatMap((entry) => {
    const item = asObject(entry);
    const ratio = asObject(item?.aspectRatio);
    const parsed = item && image(item.fullsize, item.alt, ratio?.width, ratio?.height);
    return parsed ? [parsed] : [];
  });
  const external = asObject(embed?.external) ?? asObject(media?.external);
  const thumbnail = external ? image(external.thumb, str(external.title)) : undefined;
  const name = str(author.displayName) ?? str(author.handle);
  if (!name) return null;
  const handle = str(author.handle);

  return {
    text: plainText(str(record.text)),
    author: {
      name,
      ...(handle ? { handle: `@${handle}`, url: `https://bsky.app/profile/${handle}` } : {}),
      ...optional("avatar", image(author.avatar, name)),
    },
    ...optional("publishedAt", isoDate(record.createdAt)),
    ...optional("thumbnail", thumbnail),
    ...(mediaImages.length ? { media: mediaImages.slice(0, MAX_MEDIA) } : {}),
    fetchedAt,
  };
}

function parseMastodon(body: string, fetchedAt: string): EmbedSnapshot | null {
  const status = asObject(JSON.parse(body));
  const account = asObject(status?.account);
  if (!status || !account) return null;
  const name = str(account.display_name) ?? str(account.acct) ?? str(account.username);
  if (!name) return null;

  const attachments = Array.isArray(status.media_attachments) ? status.media_attachments : [];
  const media = attachments.flatMap((entry) => {
    const item = asObject(entry);
    if (item?.type !== "image") return [];
    const original = asObject(asObject(item.meta)?.original);
    const parsed = image(item.url, item.description, original?.width, original?.height);
    return parsed ? [parsed] : [];
  });
  const spoiler = str(status.spoiler_text);
  const content = str(status.content);

  return {
    text: plainText(
      [spoiler, content ? htmlFragmentToText(content) : undefined].filter(Boolean).join("\n\n"),
    ),
    author: {
      name,
      ...optional("handle", str(account.acct) && `@${str(account.acct)}`),
      ...optional("url", httpUrl(account.url)),
      ...optional("avatar", image(account.avatar_static ?? account.avatar, name)),
    },
    ...optional("publishedAt", isoDate(status.created_at)),
    ...(media.length ? { media: media.slice(0, MAX_MEDIA) } : {}),
    fetchedAt,
  };
}

function parseXOembed(body: string, fetchedAt: string): EmbedSnapshot | null {
  const oembed = asObject(JSON.parse(body));
  const html = str(oembed?.html);
  const name = str(oembed?.author_name);
  if (!html || !name) return null;
  const paragraph = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(html)?.[1];
  if (!paragraph) return null;
  const authorUrl = httpUrl(oembed?.author_url);
  const handle = authorUrl ? new URL(authorUrl).pathname.split("/").filter(Boolean)[0] : undefined;
  return {
    text: plainText(htmlFragmentToText(paragraph)),
    author: {
      name,
      ...(handle ? { handle: `@${handle}` } : {}),
      ...optional("url", authorUrl),
    },
    fetchedAt,
  };
}

/** Threads and Instagram expose no public API; their pages carry Open Graph metadata. */
function parseOpenGraph(html: string, fetchedAt: string): EmbedSnapshot | null {
  const title = meta(html, "og:title");
  const description = meta(html, "og:description");
  if (!title && !description) return null;
  const match = title && /^(.*?)\s*\(@([^)]+)\)/.exec(title);
  const name = match ? match[1]!.trim() : undefined;
  const handle = match ? match[2] : undefined;
  const thumbnail = image(meta(html, "og:image"), title ?? "");
  return {
    text: plainText(description),
    ...(name ? { author: { name, ...(handle ? { handle: `@${handle}` } : {}) } } : {}),
    ...optional("thumbnail", thumbnail),
    fetchedAt,
  };
}

function optional<K extends string, V>(
  key: K,
  value: V | undefined | false | "",
): Partial<Record<K, V>> {
  return value ? ({ [key]: value } as Record<K, V>) : {};
}

/**
 * Parses a provider response into `embed.snapshot`. Returns null for anything unusable; callers
 * leave the embed untouched in that case.
 */
export function parseSnapshot(
  provider: SnapshotProvider,
  body: string,
  fetchedAt: string,
): EmbedSnapshot | null {
  try {
    switch (provider) {
      case "bluesky":
        return parseBluesky(body, fetchedAt);
      case "mastodon":
        return parseMastodon(body, fetchedAt);
      case "x":
        return parseXOembed(body, fetchedAt);
      case "threads":
      case "instagram":
        return parseOpenGraph(body, fetchedAt);
    }
  } catch {
    return null;
  }
}
