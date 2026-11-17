import { Effect } from "effect";
import {
  classifyFeedCategories,
  classifyItemCategories,
  CLASSIFIER_TAXONOMY_VERSION,
  embeddingModelInfo,
  KEYWORD_CLASSIFIER_METHOD,
  KEYWORD_CLASSIFIER_MODEL_ID,
  MAX_CLASSIFIER_LABELS,
  shouldSuppressFallback,
  type ClassifierModelInfo,
  type EmbeddingClassifierConfig,
  type InferredCategoryLabel,
} from "@kyomi/ingest";
import { AppLogger } from "@adapters/logger/service";
import { embeddingClassifierConfig } from "@config/embeddings";
import { AppConfig } from "@config/env/service";
import { failureMessage, EmbeddingsIncomplete, EmbeddingsNotConfigured } from "../errors";
import { Embeddings } from "../embeddings";
import type {
  BackfillArgs,
  BackfillClassifier,
  BackfillFeedRow,
  BackfillItemRecord,
  BackfillItemRow,
  BackfillStats,
} from "./types";

const KEYWORD_MODEL: ClassifierModelInfo = {
  modelId: KEYWORD_CLASSIFIER_MODEL_ID,
  taxonomyVersion: CLASSIFIER_TAXONOMY_VERSION,
  classifierMethod: KEYWORD_CLASSIFIER_METHOD,
};

/** The classifier a run writes rows for, resolved from the flags and the embeddings config. */
export const resolveBackfillClassifier = Effect.fn("catalog.backfill.classifier")(function* (
  args: BackfillArgs,
) {
  if (args.classifier === "keyword") {
    return { method: "keyword", model: KEYWORD_MODEL } satisfies BackfillClassifier;
  }
  // Same provider selection as the worker, so backfilled rows carry the model id that refresh and
  // extraction write and replace.
  const embeddingConfig = embeddingClassifierConfig(undefined, yield* AppConfig);
  if (!embeddingConfig) {
    return yield* new EmbeddingsNotConfigured({
      message:
        "CLOUDFLARE_EMBEDDINGS_URL and CLOUDFLARE_EMBEDDINGS_TOKEN are required when --classifier embedding is used",
    });
  }
  return {
    method: "embedding",
    embeddingConfig,
    model: embeddingModelInfo(embeddingConfig),
  } satisfies BackfillClassifier;
});

// `??`, not `||`: a ready extraction with empty text is what extraction re-classified from.
function classifierContentText(item: BackfillItemRow): string | null {
  return item.extractedContentText ?? item.contentText;
}

/**
 * Whether an applied backfill should replace this item's classifier rows. An abstention on ready
 * extracted text is the same "no new information" extraction re-classification keeps labels for,
 * so the labels refresh assigned stay instead of being synced away.
 */
export function syncsItemLabels(
  item: BackfillItemRow,
  inferredCategoryLabels: readonly InferredCategoryLabel[],
): boolean {
  return inferredCategoryLabels.length > 0 || item.extractedContentText == null;
}

function feedClassificationInput(feed: BackfillFeedRow) {
  return {
    feedTitle: feed.title,
    feedDescription: feed.description,
    feedUrl: feed.url,
    feedSiteUrl: feed.link,
    sourceKind: feed.sourceKind,
  };
}

export type InferredFeed = {
  categories: InferredCategoryLabel[];
  suppressedFallback: boolean;
};

export function inferFeedCategories(feed: BackfillFeedRow): InferredFeed {
  const input = feedClassificationInput(feed);
  if (shouldSuppressFallback(input)) {
    return { categories: [], suppressedFallback: true };
  }
  return { categories: classifyFeedCategories(input).categories, suppressedFallback: false };
}

function itemClassificationInput(feed: BackfillFeedRow, item: BackfillItemRow) {
  return {
    ...feedClassificationInput(feed),
    itemTitle: item.title,
    itemSummary: item.summary,
    itemContentText: classifierContentText(item),
    itemUrl: item.link || item.canonicalUrl,
  };
}

export function inferItemCategories(
  feed: BackfillFeedRow,
  item: BackfillItemRow,
): InferredCategoryLabel[] {
  return classifyItemCategories(itemClassificationInput(feed, item)).categories;
}

export const inferFeedEmbedding = Effect.fn("catalog.backfill.inferFeedEmbedding")(function* (
  feed: BackfillFeedRow,
  config: EmbeddingClassifierConfig,
) {
  const input = feedClassificationInput(feed);
  if (shouldSuppressFallback(input)) {
    return { categories: [], suppressedFallback: true } satisfies InferredFeed;
  }
  const embeddings = yield* Embeddings;
  const classification = yield* embeddings.classifyFeed(input, config);
  return {
    categories: classification.categories,
    suppressedFallback: false,
  } satisfies InferredFeed;
});

/** Embeds a page of one feed's items in one batched call; items whose request failed are absent. */
export const inferItemEmbeddings = Effect.fn("catalog.backfill.inferItemEmbeddings")(function* (
  feed: BackfillFeedRow,
  items: ReadonlyArray<BackfillItemRecord>,
  config: EmbeddingClassifierConfig,
) {
  const embeddings = yield* Embeddings;
  const classifications = yield* embeddings.classifyItems(
    items.map((item) => ({
      id: item.id,
      ...itemClassificationInput(feed, item),
      maxLabels: MAX_CLASSIFIER_LABELS,
    })),
    config,
  );
  return new Map(
    [...classifications].map(([id, classification]) => [id, classification.categories]),
  );
});

/**
 * A failing embedding call (rate limit, transient network error) must not abort a bulk backfill
 * run that may be hours into processing thousands of items, and must not be written as an
 * abstention that deletes existing rows. It's counted, logged, and failed so only this feed is
 * recorded as failed, which `--retry-failed` picks up later.
 */
export const inferClassifierFeed = Effect.fn("catalog.backfill.inferFeed")(function* (
  feed: BackfillFeedRow,
  classifier: BackfillClassifier,
  stats: BackfillStats,
) {
  if (classifier.method === "keyword") {
    return inferFeedCategories(feed);
  }
  const log = yield* AppLogger;
  return yield* inferFeedEmbedding(feed, classifier.embeddingConfig).pipe(
    Effect.tapError((error) => {
      stats.itemEmbeddingFailures += 1;
      return log.warn("catalog.backfill.feed_embedding_failed", {
        feedUrl: feed.url,
        error: failureMessage(error),
      });
    }),
  );
});

export const inferClassifierItems = Effect.fn("catalog.backfill.inferItems")(function* (
  feed: BackfillFeedRow,
  items: ReadonlyArray<BackfillItemRecord>,
  classifier: BackfillClassifier,
  stats: BackfillStats,
) {
  if (classifier.method === "keyword") {
    return items.map((item) => ({
      id: item.id,
      inferredCategoryLabels: inferItemCategories(feed, item),
    }));
  }
  const log = yield* AppLogger;
  const labelsById = yield* inferItemEmbeddings(feed, items, classifier.embeddingConfig).pipe(
    Effect.catchTag("UpstreamError", (error) =>
      log
        .warn("catalog.backfill.item_embedding_failed", {
          feedUrl: feed.url,
          itemCount: items.length,
          error: failureMessage(error),
        })
        .pipe(Effect.as(new Map<string, InferredCategoryLabel[]>())),
    ),
  );
  const failedItems = items.length - labelsById.size;
  if (failedItems > 0) {
    stats.itemEmbeddingFailures += failedItems;
    return yield* new EmbeddingsIncomplete({ failed: failedItems, total: items.length });
  }
  return items.map((item) => ({
    id: item.id,
    inferredCategoryLabels: labelsById.get(item.id) ?? [],
  }));
});
