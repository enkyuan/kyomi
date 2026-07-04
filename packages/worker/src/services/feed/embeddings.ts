import { createHash } from "node:crypto";
import { MISCELLANEOUS_CATEGORY_LABEL } from "@kyomi/db";
import { CATEGORY_CARDS } from "./category-cards";
import { EMBEDDING_CLASSIFIER_MODEL_ID } from "./taxonomy";
import type {
  CategoryClassification,
  FeedCategoryClassificationInput,
  FeedItemCategoryClassificationInput,
} from "./classifier";
import { MAX_CLASSIFIER_LABELS } from "./classifier";

export type EmbeddingClassifierConfig = {
  apiKey: string;
  model?: string;
  /** Override for tests; defaults to Voyage's public embeddings endpoint. */
  apiUrl?: string;
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

type VoyageEmbeddingsResponse = {
  data: Array<{ embedding: number[]; index: number }>;
};

/**
 * Calls Voyage's embeddings endpoint for a batch of input strings, returning one vector per
 * input in the same order. Batches in a single request (Voyage accepts an array) rather than
 * one call per string, so classifying feed-level + all item-level text in one refresh costs
 * one round trip.
 */
export async function embedTexts(
  texts: readonly string[],
  config: EmbeddingClassifierConfig,
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }
  const response = await fetch(config.apiUrl ?? DEFAULT_VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      input: texts,
      model: config.model ?? DEFAULT_VOYAGE_MODEL,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Voyage embeddings request failed (${response.status}): ${body}`);
  }
  const payload = (await response.json()) as VoyageEmbeddingsResponse;
  // Voyage documents `data` as returned in the same order as `input`, but sorts by `index`
  // defensively in case a future API version reorders results for batching efficiency.
  return [...payload.data].sort((a, b) => a.index - b.index).map((entry) => entry.embedding);
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

function cacheKeyFor(config: EmbeddingClassifierConfig): string {
  return `${config.apiUrl ?? DEFAULT_VOYAGE_API_URL}::${config.model ?? DEFAULT_VOYAGE_MODEL}::${apiKeyFingerprint(config.apiKey)}`;
}

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
      const allEmbeddings = await embedTexts(allTexts, config);
      let cursor = 0;
      return CATEGORY_CARDS.map((card) => {
        const count = 1 + card.representativeTitles.length;
        const prototypeEmbeddings = allEmbeddings.slice(cursor, cursor + count);
        cursor += count;
        return { label: card.label, prototypeEmbeddings };
      });
    })();
    prototypeCache.set(key, cached);
  }
  return cached;
}

/** Test-only escape hatch: forces the next call to re-embed prototypes instead of reusing the cache. */
export function resetCategoryPrototypeCacheForTests(): void {
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

export async function classifyFeedCategoriesByEmbedding(
  input: FeedCategoryClassificationInput,
  config: EmbeddingClassifierConfig,
): Promise<CategoryClassification> {
  const prototypes = await loadCategoryPrototypes(config);
  const [textEmbedding] = await embedTexts([buildFeedText(input)], config);
  if (!textEmbedding) {
    return { categories: [{ label: MISCELLANEOUS_CATEGORY_LABEL, confidence: 0.1 }] };
  }
  const scored = scoreAgainstPrototypes(textEmbedding, prototypes).filter(
    (entry) => entry.score >= FEED_SIMILARITY_THRESHOLD,
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

export async function classifyFeedItemCategoriesByEmbedding(
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
  const scored = scoreAgainstPrototypes(textEmbedding, prototypes).filter(
    (entry) => entry.score >= ITEM_SIMILARITY_THRESHOLD,
  );
  return {
    categories: scored
      .slice(0, maxLabels)
      .map((entry) => ({ label: entry.label, confidence: toConfidence(entry.score) })),
  };
}
