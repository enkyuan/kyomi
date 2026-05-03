import { parseHTML } from "linkedom";

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
 */
export function discoverFeedUrlFromHtml(body: string, baseUrl: string): string | null {
  const { document } = parseHTML(body);
  const links = Array.from(document.querySelectorAll("link[href]"));
  const candidates: FeedLinkCandidate[] = [];

  for (const link of links) {
    const relTokens = normalizeRel(link.getAttribute("rel"));
    if (!relTokens.includes("alternate")) {
      continue;
    }

    const type = normalizeType(link.getAttribute("type"));
    const score = FEED_CONTENT_TYPE_SCORES.get(type);
    if (score === undefined) {
      continue;
    }

    const href = resolveCandidateHref(link.getAttribute("href"), baseUrl);
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
