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

/**
 * Extract a feed URL from HTML autodiscovery tags such as:
 * `<link rel="alternate" type="application/rss+xml" href="/feed.xml">`.
 *
 * Uses fast regex scanning over the <head> tag to prevent blocking the event loop on huge documents.
 */
export function discoverFeedUrlFromHtml(body: string, baseUrl: string): string | null {
  const headMatch = body.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const headHtml = headMatch ? headMatch[1] : body.slice(0, 32768);

  const linkRegex = /<link[^>]*>/gi;
  const candidates: FeedLinkCandidate[] = [];
  let match;

  while ((match = linkRegex.exec(headHtml)) !== null) {
    const tag = match[0];

    // Extract attributes using simple regex
    const relMatch = tag.match(/\brel\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
    const typeMatch = tag.match(/\btype\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
    const hrefMatch = tag.match(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);

    const rel = relMatch ? relMatch[1] || relMatch[2] || relMatch[3] : null;
    const type = typeMatch ? typeMatch[1] || typeMatch[2] || typeMatch[3] : null;
    const rawHref = hrefMatch ? hrefMatch[1] || hrefMatch[2] || hrefMatch[3] : null;

    const relTokens = normalizeRel(rel);
    if (!relTokens.includes("alternate")) {
      continue;
    }

    const normalizedType = normalizeType(type);
    const score = FEED_CONTENT_TYPE_SCORES.get(normalizedType);
    if (score === undefined) {
      continue;
    }

    const href = resolveCandidateHref(rawHref, baseUrl);
    if (!href) {
      continue;
    }

    candidates.push({ href, score });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => left.score - right.score);
  return candidates[0]?.href ?? null;
}
