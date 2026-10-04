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
};

const DEFAULT_VOYAGE_MODEL = EMBEDDING_CLASSIFIER_MODEL_ID;
const DEFAULT_VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
// Empirically tuned against tests/api/integration/modules/feeds/refresh/classifier-eval-fixture.ts
// via classifier-eval-embedding.test.ts (live Voyage API). Re-validate against that fixture if
// the model, category cards, or fixture change materially.
//
// A relative-margin secondary-label rule (admit a second category within some gap of the top
// score) was tried and reverted: genuinely dual-topic articles (e.g. "Congress debates AI
// regulation" -> Politics & Policy + AI & ML, gap ~0.32) and single-topic articles with a
// semantically adjacent runner-up (e.g. "Anthropic releases new Claude model" wrongly picking
// up Software Engineering, gap ~0.29) produce the same gap sizes -- no margin value separates
// them without hand-tuning per category pair against this ~30-item fixture, which is
// overfitting, not a real fix. A single absolute threshold with no secondary-label margin is
// the simplest rule that doesn't require that per-pair tuning.
const ITEM_SIMILARITY_THRESHOLD = 0.6;
const FEED_SIMILARITY_THRESHOLD = 0.6;
// Inputs per embeddings request. Larger batches go out as several requests, so a slow or failed
// request costs one chunk and every request stays inside its timeout.
const EMBEDDING_REQUEST_MAX_INPUTS = 128;
// Category prototypes are shared by every caller with the same provider, so their load uses this
// timeout instead of a caller's short budget.
const PROTOTYPE_REQUEST_TIMEOUT_MS = 60_000;

type VoyageEmbeddingsResponse = {
  data: Array<{ embedding: number[]; index: number }>;
};

function chunked<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let start = 0; start < values.length; start += size) {
    chunks.push(values.slice(start, start + size));
  }
  return chunks;
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
 * Embeds input strings, returning one vector per input in the same order. Sends up to
 * EMBEDDING_REQUEST_MAX_INPUTS strings per request (Voyage and the embeddings Worker both accept
 * arrays), so `timeoutMs` bounds each request rather than the whole batch.
 */
export async function embedTexts(
  texts: readonly string[],
  config: EmbeddingClassifierConfig,
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (const chunk of chunked(texts, EMBEDDING_REQUEST_MAX_INPUTS)) {
    vectors.push(...(await requestEmbeddings(chunk, config)));
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
): Array<{ label: string; score: number }> {
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
  return [input.itemTitle, input.itemSummary, input.itemContentText].filter(Boolean).join(". ");
}

export async function classifyFeedEmbedding(
  input: FeedCategoryClassificationInput,
  config: EmbeddingClassifierConfig,
): Promise<CategoryClassification> {
  const prototypes = await loadCategoryPrototypes(config);
  const [textEmbedding] = await embedTexts([buildFeedText(input)], config);
  if (!textEmbedding) {
    return { categories: [{ label: MISCELLANEOUS_CATEGORY_LABEL, confidence: 0.1 }] };
  }

  const feedSimilarityThreshold = config.feedSimilarityThreshold ?? FEED_SIMILARITY_THRESHOLD;
  const scored = scoreAgainstPrototypes(textEmbedding, prototypes).filter(
    (entry) => entry.score >= feedSimilarityThreshold,
  );
  if (scored.length === 0) {
    // A feed always needs some label, mirroring the keyword classifier's feed-level
    // `allowGeneralFallback: true` — unlike an individual article, a feed cannot simply
    // abstain, or it would show no categorization at all in the UI indefinitely.
    return { categories: [{ label: MISCELLANEOUS_CATEGORY_LABEL, confidence: 0.1 }] };
  }
  return {
    categories: scored
      .slice(0, MAX_CLASSIFIER_LABELS)
      .map((entry) => ({ label: entry.label, confidence: toConfidence(entry.score) })),
  };
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
  const prototypes = await loadCategoryPrototypes(config);
  const [textEmbedding] = await embedTexts([buildItemText(input)], config);
  if (!textEmbedding) {
    return { categories: [] };
  }
  const itemSimilarityThreshold = config.itemSimilarityThreshold ?? ITEM_SIMILARITY_THRESHOLD;
  const scored = scoreAgainstPrototypes(textEmbedding, prototypes).filter(
    (entry) => entry.score >= itemSimilarityThreshold,
  );
  return {
    categories: scored
      .slice(0, maxLabels)
      .map((entry) => ({ label: entry.label, confidence: toConfidence(entry.score) })),
  };
}

/**
 * Classifies items with one embeddings request per EMBEDDING_REQUEST_MAX_INPUTS items. Items in a
 * failed request are left out of the result so callers keep those items' existing labels; the
 * error is rethrown only when every request failed.
 */
export async function classifyItemEmbeddings(
  inputs: readonly FeedItemEmbeddingBatchInput[],
  config: EmbeddingClassifierConfig,
): Promise<Map<string, CategoryClassification>> {
  const results = new Map<string, CategoryClassification>();
  if (inputs.length === 0) {
    return results;
  }

  const prototypes = await loadCategoryPrototypes(config);
  const itemSimilarityThreshold = config.itemSimilarityThreshold ?? ITEM_SIMILARITY_THRESHOLD;
  let failure: unknown;
  for (const chunk of chunked(inputs, EMBEDDING_REQUEST_MAX_INPUTS)) {
    let textEmbeddings: number[][];
    try {
      textEmbeddings = await requestEmbeddings(chunk.map(buildItemText), config);
    } catch (error) {
      failure = error;
      continue;
    }
    chunk.forEach((input, index) => {
      const textEmbedding = textEmbeddings[index];
      if (!textEmbedding) {
        results.set(input.id, { categories: [] });
        return;
      }

      const scored = scoreAgainstPrototypes(textEmbedding, prototypes).filter(
        (entry) => entry.score >= itemSimilarityThreshold,
      );
      results.set(input.id, {
        categories: scored
          .slice(0, input.maxLabels ?? CATEGORY_CARDS.length)
          .map((entry) => ({ label: entry.label, confidence: toConfidence(entry.score) })),
      });
    });
  }

  if (results.size === 0 && failure !== undefined) {
    throw failure;
  }
  return results;
}
