type FeedLinkCandidate = {
  href: string;
  score: number;
};

const FEED_CONTENT_TYPE_SCORES = new Map<string, number>([
  ["application/rss+xml", 0],
  ["application/atom+xml", 1],
  ["application/feed+json", 2],
  ["application/json", 3],
  ["application/xml", 4],
  ["text/xml", 5],
]);

const ALTERNATE_REL = "alternate";

function normalizeType(value: string | null): string {
  if (!value) {
    return "";
  }
  return value.split(";")[0]?.trim().toLowerCase() ?? "";
}

function normalizeRel(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function resolveCandidateHref(href: string | null, baseUrl: string): string | null {
  if (!href) {
    return null;
  }
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function extractLinkAttribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s>]+))`, "i"));
  if (!match) {
    return null;
  }
  return match[1] || match[2] || match[3] || null;
}

function parseFeedLinkCandidate(tag: string, baseUrl: string): FeedLinkCandidate | null {
  const rel = extractLinkAttribute(tag, "rel");
  const type = extractLinkAttribute(tag, "type");
  const rawHref = extractLinkAttribute(tag, "href");

  const relTokens = normalizeRel(rel);
  if (!relTokens.includes(ALTERNATE_REL)) {
    return null;
  }

  const normalizedType = normalizeType(type);
  const score = FEED_CONTENT_TYPE_SCORES.get(normalizedType);
  if (score === undefined) {
    return null;
  }

  const href = resolveCandidateHref(rawHref, baseUrl);
  if (!href) {
    return null;
  }

  return { href, score };
}

function collectFeedLinkCandidates(headHtml: string, baseUrl: string): FeedLinkCandidate[] {
  const linkRegex = /<link[^>]*>/gi;
  const candidates: FeedLinkCandidate[] = [];
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(headHtml)) !== null) {
    const candidate = parseFeedLinkCandidate(match[0], baseUrl);
    if (candidate) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

/**
 * Extract a feed URL from HTML autodiscovery tags such as:
 * `<link rel="alternate" type="application/rss+xml" href="/feed.xml">`.
 *
 * Uses fast regex scanning over the <head> tag to avoid treating generic HTML
 * as a feed format or blocking on large publisher pages.
 */
export function discoverFeedUrlFromHtml(body: string, baseUrl: string): string | null {
  const headMatch = body.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headHtml = headMatch ? headMatch[1] : body.slice(0, 32768);
  const candidates = collectFeedLinkCandidates(headHtml, baseUrl);

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => left.score - right.score);
  return candidates[0]?.href ?? null;
}
