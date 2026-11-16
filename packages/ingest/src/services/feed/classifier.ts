import {
  CATEGORY_TAXONOMY,
  MISCELLANEOUS_CATEGORY_LABEL,
  MIXED_FEED_HOSTS,
  type CategoryTaxonomyEntry,
} from "./taxonomy";

export type InferredCategoryLabel = {
  label: string;
  confidence: number;
};

export type CategoryClassification = {
  categories: InferredCategoryLabel[];
};

export type FeedCategoryClassificationInput = {
  feedTitle: string;
  feedDescription: string | null;
  feedUrl: string;
  feedSiteUrl: string | null;
  sourceKind: string | null;
};

export type FeedItemCategoryClassificationInput = FeedCategoryClassificationInput & {
  itemTitle: string;
  itemSummary: string | null;
  itemContentText?: string | null;
  itemUrl: string | null;
};

export const MAX_CLASSIFIER_LABELS = 2;
const FEED_SCORE_THRESHOLD = 3;
const ITEM_SCORE_THRESHOLD = 4;
const STRONG_TITLE_KEYWORD_SCORE = 3;
const STRONG_BODY_KEYWORD_SCORE = 1;
const WEAK_KEYWORD_SCORE = 1;
const DOMAIN_HINT_SCORE = 3;
const STRONG_DOMAIN_HINT_SCORE = 4;

function safeHost(url: string | null): string {
  if (!url) {
    return "";
  }
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

// Single-word keyword patterns are reused across every classify call, so compile each one
// once instead of rebuilding it (~150 taxonomy keywords x 2 checks) on every call.
const keywordPatternCache = new Map<string, RegExp>();

function keywordPattern(normalizedToken: string): RegExp {
  let pattern = keywordPatternCache.get(normalizedToken);
  if (!pattern) {
    const escaped = normalizedToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Tolerate simple plural forms (attack/attacks); vulnerability/vulnerabilities-style
    // "-ies" is out of scope for this suffix rule, but "-s"/"-es" covers common headline text.
    pattern = new RegExp(`(^|[^a-z0-9])${escaped}(e?s)?([^a-z0-9]|$)`);
    keywordPatternCache.set(normalizedToken, pattern);
  }
  return pattern;
}

function includesToken(text: string, token: string): boolean {
  const normalized = normalizeText(token);
  if (normalized.includes(" ")) {
    return text.includes(normalized);
  }
  return keywordPattern(normalized).test(text);
}

function scoreCategory(
  entry: CategoryTaxonomyEntry,
  input: {
    titleText: string;
    bodyText: string;
    hosts: readonly string[];
  },
): number {
  let score = 0;
  for (const keyword of entry.keywords) {
    if (includesToken(input.titleText, keyword)) {
      score += STRONG_TITLE_KEYWORD_SCORE;
    }
    if (includesToken(input.bodyText, keyword)) {
      score += STRONG_BODY_KEYWORD_SCORE;
    }
  }
  for (const keyword of entry.weakKeywords ?? []) {
    if (includesToken(input.titleText, keyword) || includesToken(input.bodyText, keyword)) {
      score += WEAK_KEYWORD_SCORE;
    }
  }
  for (const host of input.hosts) {
    if (!host) {
      continue;
    }
    const strongDomainMatch = entry.strongDomainHints?.some(
      (hint) => host === hint || host.endsWith(`.${hint}`),
    );
    if (strongDomainMatch) {
      score += STRONG_DOMAIN_HINT_SCORE;
      continue;
    }
    if (entry.domainHints.some((hint) => host === hint || host.endsWith(`.${hint}`))) {
      score += DOMAIN_HINT_SCORE;
    }
  }
  return score;
}

function toConfidence(score: number, threshold: number): number {
  return Math.max(0.1, Math.min(0.95, Number((score / (threshold + 5)).toFixed(2))));
}

function topCategories(input: {
  titleText: string;
  bodyText: string;
  hosts: readonly string[];
  threshold: number;
  allowGeneralFallback: boolean;
  maxLabels: number;
}): InferredCategoryLabel[] {
  const scored = CATEGORY_TAXONOMY.map((entry) => ({
    label: entry.label,
    score: scoreCategory(entry, input),
  }))
    .filter((entry) => entry.score >= input.threshold)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, input.maxLabels)
    .map((entry) => ({
      label: entry.label,
      confidence: toConfidence(entry.score, input.threshold),
    }));

  if (scored.length > 0) {
    return scored;
  }

  return input.allowGeneralFallback
    ? [{ label: MISCELLANEOUS_CATEGORY_LABEL, confidence: 0.1 }]
    : [];
}

export function isMixedFeedHost(url: string | null): boolean {
  const host = safeHost(url);
  return MIXED_FEED_HOSTS.has(host);
}

export function shouldSuppressFallback(input: FeedCategoryClassificationInput): boolean {
  return isMixedFeedHost(input.feedUrl) || isMixedFeedHost(input.feedSiteUrl);
}

export function classifyFeedCategories(
  input: FeedCategoryClassificationInput,
): CategoryClassification {
  const feedHost = safeHost(input.feedUrl);
  const siteHost = safeHost(input.feedSiteUrl);
  const titleText = normalizeText(input.feedTitle);
  const bodyText = normalizeText(input.feedDescription);

  return {
    categories: topCategories({
      titleText,
      bodyText,
      hosts: [feedHost, siteHost],
      threshold: FEED_SCORE_THRESHOLD,
      allowGeneralFallback: true,
      maxLabels: MAX_CLASSIFIER_LABELS,
    }),
  };
}

export function classifyItemCategories(
  input: FeedItemCategoryClassificationInput,
  // Callers that will post-filter the result (e.g. to drop labels already covered by an
  // explicit source category) should request more candidates than they intend to keep:
  // topCategories() truncates to maxLabels BEFORE the caller ever sees the list, so a
  // caller filtering after receiving only MAX_CLASSIFIER_LABELS results could discard a
  // real match and be left with fewer labels than the chip slots it actually has open.
  maxLabels: number = MAX_CLASSIFIER_LABELS,
): CategoryClassification {
  const itemHost = safeHost(input.itemUrl);
  const titleText = normalizeText(input.itemTitle);
  const bodyText = normalizeText(
    [input.itemSummary, input.itemContentText].filter(Boolean).join(" "),
  );

  return {
    categories: topCategories({
      titleText,
      bodyText,
      hosts: [itemHost],
      threshold: ITEM_SCORE_THRESHOLD,
      allowGeneralFallback: false,
      maxLabels,
    }),
  };
}
