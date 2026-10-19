import { CANONICAL_CATEGORY_LABELS, MISCELLANEOUS_CATEGORY_LABEL } from "@kyomi/db";
import { decodeCategoryModel, scoreWithCategoryModel, type CategoryModel } from "./category-model";
import { CATEGORY_MODEL_WEIGHTS } from "./category-model-weights";
import type { ClassifierModelInfo } from "./categories";
import {
  CLASSIFIER_TAXONOMY_VERSION,
  EMBEDDING_CLASSIFIER_METHOD,
  EMBEDDING_CLASSIFIER_MODEL_ID,
} from "./taxonomy";
import type {
  CategoryClassification,
  FeedCategoryClassificationInput,
  FeedItemCategoryClassificationInput,
} from "./classifier";
import { MAX_CLASSIFIER_LABELS } from "./classifier";

/** Kyomi's embeddings Worker (apps/embeddings), which serves BGE-M3 from Workers AI. */
export type EmbeddingClassifierConfig = {
  /** Bearer token for the Worker. */
  apiKey: string;
  /** The Worker's `/embed` URL. */
  apiUrl: string;
  /** Optional per-request timeout for best-effort callers that must not block user flows. */
  timeoutMs?: number;
  /** Overrides the trained article head; for tests. */
  categoryModel?: CategoryModel;
  /** Overrides the article head's minimum probability; for evals and tests. */
  itemMinProbability?: number;
  /** Overrides the article head's secondary-label margin; for evals and tests. */
  itemSecondaryMargin?: number;
  /** Overrides the feed head's minimum probability; for evals and tests. */
  feedMinProbability?: number;
  /** Overrides the feed head's secondary-label margin; for evals and tests. */
  feedSecondaryMargin?: number;
};

/** A category's probability under the trained head for a text, best first. */
export type CategoryScore = { label: string; score: number };

export type CategorySelectionRule = {
  minSimilarity: number;
  secondaryMargin?: number;
};

// Articles: chosen by 5-fold cross-validation on the training articles behind the head (see
// apps/api/src/modules/catalog/category-model). An article takes its top category when the head
// gives it at least ITEM_MIN_PROBABILITY, and a second one only within ITEM_SECONDARY_MARGIN of it.
const ITEM_MIN_PROBABILITY = 0.18;
const ITEM_SECONDARY_MARGIN = 0.4;
// Feeds: the same head scores a feed's title and description. Calibrated against
// publisher-declared feed categories with
// tests/api/integration/modules/feeds/refresh/classifier-eval-sweep.test.ts: no higher floor
// keeps every label it gets right, and a second label within FEED_SECONDARY_MARGIN is nearly as
// often right as the first. A feed below the floor falls back to Miscellaneous.
const FEED_MIN_PROBABILITY = 0.1;
const FEED_SECONDARY_MARGIN = 0.05;
// Inputs per embeddings request. Larger batches go out as several requests, so a slow or failed
// request costs one chunk and every request stays inside its timeout.
const EMBEDDING_REQUEST_MAX_INPUTS = 128;
// Characters per embeddings request, so one request of long articles stays small.
const EMBEDDING_REQUEST_MAX_CHARS = 200_000;
// Per-text cap, the same head-and-tail cut the embeddings Worker applies, so the cache keys and
// the Worker see the same text.
const MAX_CHARS_PER_INPUT = 6_000;
// Characters of title, summary, and body embedded per article. The opening carries the topic;
// later text is mostly related links, comments, and newsletter prompts that drag every
// category's similarity down, so feed text and extracted full text are cut to the same head.
const MAX_ITEM_TEXT_CHARS = 4_000;

type EmbeddingsResponse = {
  data: Array<{ embedding: number[]; index: number }>;
};

function capText(text: string): string {
  if (text.length <= MAX_CHARS_PER_INPUT) {
    return text;
  }
  // Drop a surrogate half left at either cut so the text stays valid UTF-16.
  const head = text.slice(0, 4_500).replace(/[\uD800-\uDBFF]$/, "");
  const tail = text.slice(-1_500).replace(/^[\uDC00-\uDFFF]/, "");
  return `${head}\n\n[truncated]\n\n${tail}`;
}

/**
 * Caps each text and groups items into requests of at most EMBEDDING_REQUEST_MAX_INPUTS texts and
 * EMBEDDING_REQUEST_MAX_CHARS characters.
 */
function requestBatches<T>(
  items: readonly T[],
  textOf: (item: T) => string,
): Array<{ items: T[]; texts: string[] }> {
  const batches: Array<{ items: T[]; texts: string[] }> = [];
  let current: { items: T[]; texts: string[] } = { items: [], texts: [] };
  let chars = 0;
  for (const item of items) {
    const text = capText(textOf(item));
    const full =
      current.texts.length >= EMBEDDING_REQUEST_MAX_INPUTS ||
      chars + text.length > EMBEDDING_REQUEST_MAX_CHARS;
    if (current.texts.length > 0 && full) {
      batches.push(current);
      current = { items: [], texts: [] };
      chars = 0;
    }
    current.items.push(item);
    current.texts.push(text);
    chars += text.length;
  }
  if (current.texts.length > 0) {
    batches.push(current);
  }
  return batches;
}

async function requestEmbeddings(
  texts: readonly string[],
  config: EmbeddingClassifierConfig,
): Promise<number[][]> {
  const controller = config.timeoutMs ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), config.timeoutMs) : null;
  try {
    const response = await fetch(config.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: controller?.signal,
      body: JSON.stringify({ input: texts }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Embeddings request failed (${response.status}): ${body}`);
    }
    const payload = (await response.json()) as Partial<EmbeddingsResponse>;
    // The Worker returns `data` in input order; sorting by `index` keeps that true even if a
    // future version reorders results.
    const entries = Array.isArray(payload.data)
      ? [...payload.data].sort((a, b) => a.index - b.index)
      : [];
    // Anything but one entry per input, indexed 0..n-1, would attach vectors to the wrong text.
    if (
      entries.length !== texts.length ||
      entries.some((entry, position) => entry.index !== position)
    ) {
      throw new Error(
        `Embeddings response did not match the request: ${entries.length} vectors for ${texts.length} inputs`,
      );
    }
    return entries.map((entry) => entry.embedding);
  } finally {
    // Cleared after the body is read, so a stalled response body times out too.
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

/**
 * Embeds input strings, returning one vector per input in the same order. Texts are capped and
 * sent in bounded requests, so `timeoutMs` bounds each request rather than the whole batch.
 */
export async function embedTexts(
  texts: readonly string[],
  config: EmbeddingClassifierConfig,
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (const batch of requestBatches(texts, (text) => text)) {
    vectors.push(...(await requestEmbeddings(batch.texts, config)));
  }
  return vectors;
}

export type FeedItemEmbeddingBatchInput = FeedItemCategoryClassificationInput & {
  id: string;
  maxLabels?: number;
};

/** The production article and feed rules, for evals that replay them. */
export const DEFAULT_ITEM_SELECTION_RULE: CategorySelectionRule = {
  minSimilarity: ITEM_MIN_PROBABILITY,
  secondaryMargin: ITEM_SECONDARY_MARGIN,
};
export const DEFAULT_FEED_SELECTION_RULE: CategorySelectionRule = {
  minSimilarity: FEED_MIN_PROBABILITY,
  secondaryMargin: FEED_SECONDARY_MARGIN,
};

function itemSelectionRule(config: EmbeddingClassifierConfig): CategorySelectionRule {
  return {
    minSimilarity: config.itemMinProbability ?? ITEM_MIN_PROBABILITY,
    secondaryMargin: config.itemSecondaryMargin ?? ITEM_SECONDARY_MARGIN,
  };
}

function feedSelectionRule(config: EmbeddingClassifierConfig): CategorySelectionRule {
  return {
    minSimilarity: config.feedMinProbability ?? FEED_MIN_PROBABILITY,
    secondaryMargin: config.feedSecondaryMargin ?? FEED_SECONDARY_MARGIN,
  };
}

let defaultCategoryModel: CategoryModel | undefined;

function categoryModelFor(config: EmbeddingClassifierConfig): CategoryModel {
  if (config.categoryModel) {
    return config.categoryModel;
  }
  defaultCategoryModel ??= decodeCategoryModel(CATEGORY_MODEL_WEIGHTS);
  return defaultCategoryModel;
}

/** The selection rule in effect, e.g. `item-0.2-0.3-feed-0.5-0.02`. */
function selectionRuleTag(config: EmbeddingClassifierConfig): string {
  const item = itemSelectionRule(config);
  const feed = feedSelectionRule(config);
  return `item-${item.minSimilarity}-${item.secondaryMargin}-feed-${feed.minSimilarity}-${feed.secondaryMargin}`;
}

export function embeddingModelInfo(config: EmbeddingClassifierConfig): ClassifierModelInfo {
  return {
    // Names the head and the selection rule as well as the model: any of them can yield different
    // labels for identical inputs, and rows written under another one must not read as current or
    // count as backfilled.
    modelId: `${EMBEDDING_CLASSIFIER_MODEL_ID}/${categoryModelFor(config).version}/${selectionRuleTag(config)}`,
    taxonomyVersion: CLASSIFIER_TAXONOMY_VERSION,
    classifierMethod: EMBEDDING_CLASSIFIER_METHOD,
  };
}

function toConfidence(similarity: number): number {
  return Math.max(0.1, Math.min(0.95, Number(similarity.toFixed(2))));
}

function buildFeedText(input: FeedCategoryClassificationInput): string {
  return [input.feedTitle, input.feedDescription].filter(Boolean).join(". ");
}

function buildItemText(input: FeedItemCategoryClassificationInput): string {
  const text = [input.itemTitle, input.itemSummary, input.itemContentText]
    .filter(Boolean)
    .join(". ");
  if (text.length <= MAX_ITEM_TEXT_CHARS) {
    return text;
  }
  // Drop a high surrogate left at the cut so the text stays valid UTF-16.
  return text.slice(0, MAX_ITEM_TEXT_CHARS).replace(/[\uD800-\uDBFF]$/, "");
}

function toCategoryClassification(scores: readonly CategoryScore[]): CategoryClassification {
  return {
    categories: scores.map((entry) => ({
      label: entry.label,
      confidence: toConfidence(entry.score),
    })),
  };
}

/**
 * Picks labels from category scores sorted high to low. The top category is kept when it
 * clears `minSimilarity`. Each further category must also clear it and sit within
 * `secondaryMargin` of the top score, so a semantically adjacent runner-up doesn't ride along
 * on a single-topic text. Without a margin every category over the floor qualifies.
 */
export function selectCategories(
  scores: readonly CategoryScore[],
  rule: CategorySelectionRule,
  maxLabels: number,
): CategoryScore[] {
  const [top] = scores;
  if (!top || top.score < rule.minSimilarity) {
    return [];
  }
  const margin = rule.secondaryMargin ?? Number.POSITIVE_INFINITY;
  return scores
    .filter(
      (entry, index) =>
        index === 0 || (entry.score >= rule.minSimilarity && top.score - entry.score <= margin),
    )
    .slice(0, maxLabels);
}

/** Scores a feed's title and description with the trained head, best first. */
export async function scoreFeedEmbedding(
  input: FeedCategoryClassificationInput,
  config: EmbeddingClassifierConfig,
): Promise<CategoryScore[]> {
  const model = categoryModelFor(config);
  const [textEmbedding] = await embedTexts([buildFeedText(input)], config);
  return textEmbedding ? scoreWithCategoryModel(model, textEmbedding) : [];
}

/**
 * Embeds items' title, summary, and opening text in bounded requests, returning each item's vector
 * by id. Items in a failed request are left out; the error is rethrown only when every request
 * failed.
 */
export async function embedItemVectors(
  inputs: ReadonlyArray<FeedItemCategoryClassificationInput & { id: string }>,
  config: EmbeddingClassifierConfig,
): Promise<Map<string, number[]>> {
  const vectors = new Map<string, number[]>();
  let failure: unknown;
  for (const batch of requestBatches(inputs, buildItemText)) {
    let textEmbeddings: number[][];
    try {
      textEmbeddings = await requestEmbeddings(batch.texts, config);
    } catch (error) {
      failure = error;
      continue;
    }
    batch.items.forEach((input, index) => {
      const vector = textEmbeddings[index];
      if (vector) {
        vectors.set(input.id, vector);
      }
    });
  }
  if (vectors.size === 0 && failure !== undefined) {
    throw failure;
  }
  return vectors;
}

/**
 * Scores items with the trained article head, best first, in bounded embeddings requests. Items
 * in a failed request are left out of the result; the error is rethrown only when every request
 * failed.
 */
export async function scoreItemEmbeddings(
  inputs: ReadonlyArray<FeedItemCategoryClassificationInput & { id: string }>,
  config: EmbeddingClassifierConfig,
): Promise<Map<string, CategoryScore[]>> {
  if (inputs.length === 0) {
    return new Map();
  }
  const model = categoryModelFor(config);
  const vectors = await embedItemVectors(inputs, config);
  return new Map([...vectors].map(([id, vector]) => [id, scoreWithCategoryModel(model, vector)]));
}

export async function classifyFeedEmbedding(
  input: FeedCategoryClassificationInput,
  config: EmbeddingClassifierConfig,
): Promise<CategoryClassification> {
  const selected = selectCategories(
    await scoreFeedEmbedding(input, config),
    feedSelectionRule(config),
    MAX_CLASSIFIER_LABELS,
  );
  if (selected.length === 0) {
    // A feed always needs some label, mirroring the keyword classifier's feed-level
    // `allowGeneralFallback: true` — unlike an individual article, a feed cannot simply
    // abstain, or it would show no categorization at all in the UI indefinitely.
    return { categories: [{ label: MISCELLANEOUS_CATEGORY_LABEL, confidence: 0.1 }] };
  }
  return toCategoryClassification(selected);
}

export async function classifyItemEmbedding(
  input: FeedItemCategoryClassificationInput,
  config: EmbeddingClassifierConfig,
  // Unlike the keyword classifier, similarity scoring has no natural label count to default
  // to: MAX_CLASSIFIER_LABELS is a UI chip-slot budget, not evidence about how many topics an
  // article legitimately spans. Callers with a real slot budget (e.g. refresh.ts) pass their
  // own maxLabels; this default only governs raw classification (e.g. eval harnesses), so it
  // should let every category that clears the threshold through rather than truncate early.
  maxLabels: number = CANONICAL_CATEGORY_LABELS.length,
): Promise<CategoryClassification> {
  const scores = await scoreItemEmbeddings([{ ...input, id: "item" }], config);
  return toCategoryClassification(
    selectCategories(scores.get("item") ?? [], itemSelectionRule(config), maxLabels),
  );
}

/**
 * Classifies items in bounded embeddings requests. Items in a failed request are left out of the
 * result so callers keep those items' existing labels; the error is rethrown only when every
 * request failed.
 */
export async function classifyItemEmbeddings(
  inputs: readonly FeedItemEmbeddingBatchInput[],
  config: EmbeddingClassifierConfig,
): Promise<Map<string, CategoryClassification>> {
  const scores = await scoreItemEmbeddings(inputs, config);
  const rule = itemSelectionRule(config);
  const results = new Map<string, CategoryClassification>();
  for (const input of inputs) {
    const itemScores = scores.get(input.id);
    if (itemScores) {
      results.set(
        input.id,
        toCategoryClassification(
          selectCategories(itemScores, rule, input.maxLabels ?? CANONICAL_CATEGORY_LABELS.length),
        ),
      );
    }
  }
  return results;
}
