import { createHash } from "node:crypto";
import { MISCELLANEOUS_CATEGORY_LABEL } from "@kyomi/db";
import { CATEGORY_CARDS, CATEGORY_CARDS_VERSION } from "./category-cards";
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

export type EmbeddingClassifierConfig = {
  apiKey: string;
  model?: string;
  /** Embeddings endpoint; defaults to Voyage's public API. */
  apiUrl?: string;
  /** Optional per-request timeout for best-effort callers that must not block user flows. */
  timeoutMs?: number;
  /** Optional per-provider cutoff for article category similarity. */
  itemSimilarityThreshold?: number;
  /** Optional per-provider cutoff for feed category similarity. */
  feedSimilarityThreshold?: number;
  /**
   * Optional per-provider gap from the top score within which a second category is still
   * admitted. Unset, every category over the cutoff qualifies.
   */
  secondaryLabelMargin?: number;
};

/** A category's similarity to a text: its best cosine over the category's prototypes. */
export type CategoryScore = { label: string; score: number };

export type CategorySelectionRule = {
  minSimilarity: number;
  secondaryMargin?: number;
};

const DEFAULT_VOYAGE_MODEL = EMBEDDING_CLASSIFIER_MODEL_ID;
const DEFAULT_VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
// Voyage defaults, tuned against tests/api/integration/modules/feeds/refresh/classifier-eval-fixture.ts
// via classifier-eval-embedding.test.ts (live Voyage API). Other providers score on a different
// scale and set their own cutoffs and secondary-label margin in the API's provider config.
//
// With no margin, a second category is admitted whenever it clears the cutoff. On Voyage a margin
// didn't separate genuinely dual-topic headlines (e.g. "Congress debates AI regulation" ->
// Politics & Policy + AI & ML, gap ~0.32) from single-topic ones with an adjacent runner-up (gap
// ~0.29). BGE-M3's top two scores sit much closer (median gap 0.025), so a 0.02 margin there
// halves the share of two-label articles for about six points of recall.
const ITEM_SIMILARITY_THRESHOLD = 0.6;
const FEED_SIMILARITY_THRESHOLD = 0.6;
// Inputs per embeddings request. Larger batches go out as several requests, so a slow or failed
// request costs one chunk and every request stays inside its timeout.
const EMBEDDING_REQUEST_MAX_INPUTS = 128;
// Characters per embeddings request. Even at one token per character this stays well under
// Voyage's 320K-token per-request limit, so a batch of long articles can't fail as a whole.
const EMBEDDING_REQUEST_MAX_CHARS = 200_000;
// Per-text cap, the same head-and-tail cut the embeddings Worker applies, so both providers embed
// the same text.
const MAX_CHARS_PER_INPUT = 6_000;
// Category prototypes are shared by every caller with the same provider, so their load uses this
// timeout instead of a caller's short budget.
const PROTOTYPE_REQUEST_TIMEOUT_MS = 60_000;
// Characters of title, summary, and body embedded per article. The opening carries the topic;
// later text is mostly related links, comments, and newsletter prompts that drag every
// category's similarity down, so feed text and extracted full text are cut to the same head.
const MAX_ITEM_TEXT_CHARS = 4_000;

type VoyageEmbeddingsResponse = {
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
    const response = await fetch(config.apiUrl ?? DEFAULT_VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: controller?.signal,
      body: JSON.stringify({
        input: texts,
        model: config.model ?? DEFAULT_VOYAGE_MODEL,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Voyage embeddings request failed (${response.status}): ${body}`);
    }
    const payload = (await response.json()) as Partial<VoyageEmbeddingsResponse>;
    // Voyage documents `data` as returned in the same order as `input`, but sorts by `index`
    // defensively in case a future API version reorders results for batching efficiency.
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
 * sent in bounded requests (Voyage and the embeddings Worker both accept arrays), so `timeoutMs`
 * bounds each request rather than the whole batch.
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

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

type CategoryPrototypes = {
  label: string;
  prototypeEmbeddings: number[][];
};

export type FeedItemEmbeddingBatchInput = FeedItemCategoryClassificationInput & {
  id: string;
  maxLabels?: number;
};

/**
 * Per-config prototype cache. Embedding the ~70 category-card prototype texts costs one
 * Voyage call; caching by config identity (not globally) means tests that pass a fake
 * apiUrl/apiKey never share a cache with production config, while a real worker process
 * only pays the embedding cost once per config across its whole lifetime.
 */
const prototypeCache = new Map<string, Promise<CategoryPrototypes[]>>();

function apiKeyFingerprint(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex").slice(0, 12);
}

// Leaves out timeoutMs: callers with different budgets share one prototype load.
function cacheKeyFor(config: EmbeddingClassifierConfig): string {
  return `${config.apiUrl ?? DEFAULT_VOYAGE_API_URL}::${config.model ?? DEFAULT_VOYAGE_MODEL}::${apiKeyFingerprint(config.apiKey)}`;
}

export function embeddingModelInfo(config: EmbeddingClassifierConfig): ClassifierModelInfo {
  return {
    // Names the card revision as well as the provider model, because a card change can yield
    // different labels for identical inputs while the model name stays the same.
    modelId: `${config.model ?? DEFAULT_VOYAGE_MODEL}/${CATEGORY_CARDS_VERSION}`,
    taxonomyVersion: CLASSIFIER_TAXONOMY_VERSION,
    classifierMethod: EMBEDDING_CLASSIFIER_METHOD,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Category prototypes were not ready within ${timeoutMs}ms`)),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Loads prototypes under their own timeout. A caller with a shorter `timeoutMs` stops waiting at
 * its own deadline, but the load keeps running and warms the cache for the next call.
 */
async function loadCategoryPrototypes(
  config: EmbeddingClassifierConfig,
): Promise<CategoryPrototypes[]> {
  const key = cacheKeyFor(config);
  let cached = prototypeCache.get(key);
  if (!cached) {
    cached = (async () => {
      const allTexts = CATEGORY_CARDS.flatMap((card) => [
        card.description,
        ...card.representativeTitles,
      ]);
      const allEmbeddings = await embedTexts(allTexts, {
        ...config,
        timeoutMs: PROTOTYPE_REQUEST_TIMEOUT_MS,
      });
      let cursor = 0;
      return CATEGORY_CARDS.map((card) => {
        const count = 1 + card.representativeTitles.length;
        const prototypeEmbeddings = allEmbeddings.slice(cursor, cursor + count);
        cursor += count;
        return { label: card.label, prototypeEmbeddings };
      });
    })();
    prototypeCache.set(key, cached);
    cached.catch(() => {
      if (prototypeCache.get(key) === cached) {
        prototypeCache.delete(key);
      }
    });
  }
  return config.timeoutMs ? withTimeout(cached, config.timeoutMs) : cached;
}

/** Test-only escape hatch: forces the next call to re-embed prototypes instead of reusing the cache. */
export function resetPrototypeCache(): void {
  prototypeCache.clear();
}

function scoreAgainstPrototypes(
  textEmbedding: number[],
  categories: readonly CategoryPrototypes[],
): CategoryScore[] {
  return categories
    .map((category) => ({
      label: category.label,
      // Max, not mean: a title matching ANY one of a category's prototypes (its description
      // OR any single representative title) is a legitimate hit — averaging would penalize a
      // category whose other prototypes are topically distant from this particular article.
      score: Math.max(
        ...category.prototypeEmbeddings.map((prototype) =>
          cosineSimilarity(textEmbedding, prototype),
        ),
      ),
    }))
    .sort((a, b) => b.score - a.score);
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

function itemSelectionRule(config: EmbeddingClassifierConfig): CategorySelectionRule {
  return {
    minSimilarity: config.itemSimilarityThreshold ?? ITEM_SIMILARITY_THRESHOLD,
    secondaryMargin: config.secondaryLabelMargin,
  };
}

function feedSelectionRule(config: EmbeddingClassifierConfig): CategorySelectionRule {
  return {
    minSimilarity: config.feedSimilarityThreshold ?? FEED_SIMILARITY_THRESHOLD,
    secondaryMargin: config.secondaryLabelMargin,
  };
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

/** Scores a feed's title and description against every category, best first. */
export async function scoreFeedEmbedding(
  input: FeedCategoryClassificationInput,
  config: EmbeddingClassifierConfig,
): Promise<CategoryScore[]> {
  const prototypes = await loadCategoryPrototypes(config);
  const [textEmbedding] = await embedTexts([buildFeedText(input)], config);
  return textEmbedding ? scoreAgainstPrototypes(textEmbedding, prototypes) : [];
}

/**
 * Scores items against every category, best first, in bounded embeddings requests. Items in a
 * failed request are left out of the result; the error is rethrown only when every request
 * failed.
 */
export async function scoreItemEmbeddings(
  inputs: ReadonlyArray<FeedItemCategoryClassificationInput & { id: string }>,
  config: EmbeddingClassifierConfig,
): Promise<Map<string, CategoryScore[]>> {
  const results = new Map<string, CategoryScore[]>();
  if (inputs.length === 0) {
    return results;
  }

  const prototypes = await loadCategoryPrototypes(config);
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
      const textEmbedding = textEmbeddings[index];
      results.set(input.id, textEmbedding ? scoreAgainstPrototypes(textEmbedding, prototypes) : []);
    });
  }

  if (results.size === 0 && failure !== undefined) {
    throw failure;
  }
  return results;
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
  maxLabels: number = CATEGORY_CARDS.length,
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
          selectCategories(itemScores, rule, input.maxLabels ?? CATEGORY_CARDS.length),
        ),
      );
    }
  }
  return results;
}
