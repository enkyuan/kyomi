import {
  CATEGORY_TAXONOMY,
  GENERAL_CATEGORY_LABEL,
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
  itemUrl: string | null;
};

const MAX_CLASSIFIER_LABELS = 2;
const FEED_SCORE_THRESHOLD = 3;
const ITEM_SCORE_THRESHOLD = 4;

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
      score += 3;
    }
    if (includesToken(input.bodyText, keyword)) {
      score += 1;
    }
  }
  for (const host of input.hosts) {
    if (!host) {
      continue;
    }
    if (entry.domainHints.some((hint) => host === hint || host.endsWith(`.${hint}`))) {
      score += 3;
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
}): InferredCategoryLabel[] {
  const scored = CATEGORY_TAXONOMY.map((entry) => ({
    label: entry.label,
    score: scoreCategory(entry, input),
  }))
    .filter((entry) => entry.score >= input.threshold)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, MAX_CLASSIFIER_LABELS)
    .map((entry) => ({
      label: entry.label,
      confidence: toConfidence(entry.score, input.threshold),
    }));

  if (scored.length > 0) {
    return scored;
  }

  return input.allowGeneralFallback ? [{ label: GENERAL_CATEGORY_LABEL, confidence: 0.1 }] : [];
}

export function isMixedFeedHost(url: string | null): boolean {
  const host = safeHost(url);
  return MIXED_FEED_HOSTS.has(host);
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
    }),
  };
}

export function classifyFeedItemCategories(
  input: FeedItemCategoryClassificationInput,
): CategoryClassification {
  const itemHost = safeHost(input.itemUrl);
  const feedHost = safeHost(input.feedUrl);
  const siteHost = safeHost(input.feedSiteUrl);
  const titleText = normalizeText(input.itemTitle);
  const bodyText = normalizeText(
    [input.itemSummary, input.feedTitle, input.feedDescription].join(" "),
  );

  return {
    categories: topCategories({
      titleText,
      bodyText,
      hosts: [itemHost, feedHost, siteHost],
      threshold: ITEM_SCORE_THRESHOLD,
      allowGeneralFallback: false,
    }),
  };
}
