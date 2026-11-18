import { extractHeadHtml, openTags } from "../../lib/text-scan";

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

function attributePattern(name: string): RegExp {
  return new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]+)"|'([^']+)'|([^\\s>]+))`, "i");
}

const REL_PATTERN = attributePattern("rel");
const TYPE_PATTERN = attributePattern("type");
const HREF_PATTERN = attributePattern("href");

function extractLinkAttribute(tag: string, pattern: RegExp): string | null {
  const match = tag.match(pattern);
  if (!match) {
    return null;
  }
  return match[1] || match[2] || match[3] || null;
}

function parseFeedLinkCandidate(tag: string, baseUrl: string): FeedLinkCandidate | null {
  const relTokens = normalizeRel(extractLinkAttribute(tag, REL_PATTERN));
  if (!relTokens.includes(ALTERNATE_REL)) {
    return null;
  }

  const normalizedType = normalizeType(extractLinkAttribute(tag, TYPE_PATTERN));
  const score = FEED_CONTENT_TYPE_SCORES.get(normalizedType);
  if (score === undefined) {
    return null;
  }

  const href = resolveCandidateHref(extractLinkAttribute(tag, HREF_PATTERN), baseUrl);
  if (!href) {
    return null;
  }

  return { href, score };
}

function collectFeedLinkCandidates(headHtml: string, baseUrl: string): FeedLinkCandidate[] {
  const candidates: FeedLinkCandidate[] = [];
  for (const tag of openTags(headHtml, "link")) {
    const candidate = parseFeedLinkCandidate(tag, baseUrl);
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
 * Scans only the <head> (the first 256 KiB of the page at most) in one linear pass, so generic
 * HTML is never treated as a feed format and a hostile page cannot block the thread.
 */
export function discoverFeedUrlFromHtml(body: string, baseUrl: string): string | null {
  const candidates = collectFeedLinkCandidates(extractHeadHtml(body), baseUrl);

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => left.score - right.score);
  return candidates[0]?.href ?? null;
}
