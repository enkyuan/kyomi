import { XMLParser } from "fast-xml-parser";
import { decodeHtmlEntities } from "@kyomi/worker";

export type ParsedFeedMetadata = {
  title: string;
  description: string;
  link: string | null;
  iconUrl: string | null;
};

function stripTags(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
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

function textFromUnknown(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (!value || typeof value !== "object" || !("#text" in value)) {
    return null;
  }
  const text = String((value as { "#text": unknown })["#text"]).trim();
  return text || null;
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

function pickHrefFromAtomCandidate(
  item: unknown,
  relMatcher: (rel: unknown) => boolean,
): string | null {
  if (!item || typeof item !== "object") {
    return null;
  }
  const rec = item as Record<string, unknown>;
  const href = rec["@_href"];
  if (typeof href !== "string" || !href) {
    return null;
  }
  if (!relMatcher(rec["@_rel"])) {
    return null;
  }
  return href;
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
      const text = textFromUnknown(item);
      if (text) {
        return text;
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
    const href = pickHrefFromAtomCandidate(
      item,
      (rel) => rel === "alternate" || rel === undefined || rel === "self",
    );
    if (href) {
      return href;
    }
  }
  for (const item of candidates) {
    const href = pickHrefFromAtomCandidate(item, () => true);
    if (href) {
      return href;
    }
  }
  return fallback || null;
}

function pickRssImageUrl(channel: Record<string, unknown>, fallbackUrl: string): string | null {
  const image = channel.image;
  if (typeof image === "string") {
    return absoluteUrl(image.trim() || null, fallbackUrl);
  }
  if (!image || typeof image !== "object") {
    return null;
  }
  const rec = image as Record<string, unknown>;
  return absoluteUrl(textFromUnknown(rec.url) ?? textFromUnknown(rec["@_href"]), fallbackUrl);
}

function pickAtomIconUrl(feed: Record<string, unknown>, fallbackUrl: string): string | null {
  return absoluteUrl(textFromUnknown(feed.icon) ?? textFromUnknown(feed.logo), fallbackUrl);
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
  const home = absoluteHttpUrl(
    typeof rec.home_page_url === "string" ? rec.home_page_url : fallbackUrl,
    fallbackUrl,
  );
  return {
    title: title || "Untitled",
    description: description || "Follow recent articles from this feed",
    link: home || null,
    iconUrl:
      absoluteUrl(typeof rec.icon === "string" ? rec.icon : null, fallbackUrl) ??
      absoluteUrl(typeof rec.favicon === "string" ? rec.favicon : null, fallbackUrl),
  };
}

function parseRssChannel(
  channel: Record<string, unknown>,
  fallbackUrl: string,
): ParsedFeedMetadata {
  const title = xmlText(channel.title) || "Untitled";
  const description = xmlText(channel.description) || "Follow recent articles from this feed";
  const link = absoluteHttpUrl(pickLinkFromRssChannel(channel.link, fallbackUrl), fallbackUrl);
  return { title, description, link, iconUrl: pickRssImageUrl(channel, fallbackUrl) };
}

function parseAtomFeed(feed: Record<string, unknown>, fallbackUrl: string): ParsedFeedMetadata {
  const title = xmlText(feed.title) || "Untitled";
  const subtitle = xmlText(feed.subtitle);
  const description = subtitle || "Follow recent articles from this feed";
  const link = absoluteHttpUrl(pickAtomLink(feed, fallbackUrl), fallbackUrl);
  return { title, description, link, iconUrl: pickAtomIconUrl(feed, fallbackUrl) };
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

const ICON_REL_TOKEN = "icon";

function extractHeadHtml(body: string): string {
  const headMatch = body.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return headMatch ? headMatch[1] : body.slice(0, 32768);
}

function firstMetaContent(headHtml: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = headHtml.match(pattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1]).trim();
    }
  }
  return null;
}

function parseHtmlTitle(headHtml: string): string {
  const titleMatch = headHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const documentTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : "Untitled";
  if (documentTitle !== "Untitled") {
    return documentTitle;
  }

  return (
    firstMetaContent(headHtml, [
      /<meta[^>]+property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      /<meta[^>]*content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:title["']/i,
    ]) ?? "Untitled"
  );
}

function parseHtmlDescription(headHtml: string): string {
  const description =
    firstMetaContent(headHtml, [
      /<meta[^>]+name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      /<meta[^>]*content\s*=\s*["']([^"']+)["'][^>]+name\s*=\s*["']description["']/i,
    ]) ?? "";

  if (description) {
    return description;
  }

  return (
    firstMetaContent(headHtml, [
      /<meta[^>]+property\s*=\s*["']og:description["'][^>]*content\s*=\s*["']([^"']+)["']/i,
      /<meta[^>]*content\s*=\s*["']([^"']+)["'][^>]+property\s*=\s*["']og:description["']/i,
    ]) ?? "Follow recent articles from this feed"
  );
}

function extractLinkHref(tag: string): string | null {
  const hrefMatch = tag.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  if (!hrefMatch) {
    return null;
  }
  return hrefMatch[1] || hrefMatch[2] || hrefMatch[3] || null;
}

function linkTagHasIconRel(tag: string): boolean {
  const relMatch = tag.match(/\brel\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  if (!relMatch) {
    return false;
  }
  const rel = (relMatch[1] || relMatch[2] || relMatch[3]).toLowerCase();
  const relTokens = new Set(rel.split(/\s+/).filter(Boolean));
  return relTokens.has(ICON_REL_TOKEN);
}

function parseHtmlIconUrl(headHtml: string, resolvedUrl: string): string | null {
  const linkRegex = /<link[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(headHtml)) !== null) {
    const tag = match[0];
    if (!linkTagHasIconRel(tag)) {
      continue;
    }
    const href = extractLinkHref(tag);
    if (href) {
      return absoluteUrl(href, resolvedUrl);
    }
  }
  return null;
}

export function parseHtmlMetadataFallback(body: string, resolvedUrl: string): ParsedFeedMetadata {
  const headHtml = extractHeadHtml(body);
  return {
    title: parseHtmlTitle(headHtml),
    description: parseHtmlDescription(headHtml),
    link: resolvedUrl,
    iconUrl: parseHtmlIconUrl(headHtml, resolvedUrl),
  };
}
