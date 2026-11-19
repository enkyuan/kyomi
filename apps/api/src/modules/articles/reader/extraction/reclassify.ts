import { DateTime, Effect } from "effect";
import { Db, type Database } from "@adapters/db/service";
import { AppLogger } from "@adapters/logger/service";
import { categories, feedItemCategoryAssignments } from "@kyomi/db";
import { and, eq, ne } from "drizzle-orm";
import type { ArticleDetailDto } from "@modules/articles/types";
import {
  CATEGORY_CLASSIFIER_PROVENANCE,
  CLASSIFIER_TAXONOMY_VERSION,
  classifyItemCategories,
  classifyItemEmbedding,
  KEYWORD_CLASSIFIER_METHOD,
  KEYWORD_CLASSIFIER_MODEL_ID,
  embeddingModelInfo,
  MAX_CLASSIFIER_LABELS,
  syncItemInferences,
  type ClassifierModelInfo,
  type EmbeddingClassifierConfig,
  type InferredCategoryLabel,
} from "@kyomi/ingest";
import { UpstreamError } from "@shared/effect/errors";
import { serializeError } from "@shared/errors/serialize";

const KEYWORD_EXTRACTED_ITEM_CLASSIFIER_MODEL: ClassifierModelInfo = {
  modelId: KEYWORD_CLASSIFIER_MODEL_ID,
  taxonomyVersion: CLASSIFIER_TAXONOMY_VERSION,
  classifierMethod: KEYWORD_CLASSIFIER_METHOD,
};

async function loadExplicitItemCategoryLabels(
  database: Database,
  articleId: string,
): Promise<string[]> {
  const rows = await database
    .select({ label: categories.label })
    .from(feedItemCategoryAssignments)
    .innerJoin(categories, eq(feedItemCategoryAssignments.categoryId, categories.id))
    .where(
      and(
        eq(feedItemCategoryAssignments.feedItemId, articleId),
        ne(feedItemCategoryAssignments.provenance, CATEGORY_CLASSIFIER_PROVENANCE),
      ),
    );

  return rows.map((row) => row.label);
}

/**
 * Refresh a feed item's classifier labels from its extracted text: a keyword pass, then an
 * embedding pass when the Worker is configured. Best effort by design: a failed pass is logged
 * and leaves the labels refresh already wrote, so the extraction itself never fails here.
 */
export const reclassifyExtractedFeedItem = Effect.fn("extraction.reclassify")(function* (
  article: ArticleDetailDto,
  extractedText: string,
  embeddingConfig?: EmbeddingClassifierConfig,
) {
  if (article.articleType !== "feed") {
    return;
  }
  const db = yield* Db;
  const log = yield* AppLogger;

  const sync = (inferredCategoryLabels: InferredCategoryLabel[], model: ClassifierModelInfo) =>
    Effect.flatMap(DateTime.nowAsDate, (now) =>
      db.use("sync item inferences", (client) =>
        syncItemInferences(
          client,
          { items: [{ id: article.id, inferredCategoryLabels }], model },
          now,
        ),
      ),
    );
  const warnFailed = (classifierMethod: string) => (error: { readonly cause?: unknown }) =>
    log.warn("articles.extract_full_text.categories_reclassify_failed", {
      articleId: article.id,
      classifierMethod,
      error: serializeError(error.cause ?? error),
    });
  const classifierInput = {
    feedTitle: article.feedTitle,
    feedDescription: null,
    feedUrl: article.feedUrl ?? article.link,
    feedSiteUrl: article.feedSiteUrl,
    sourceKind: null,
    itemTitle: article.title,
    itemSummary: article.summary,
    itemContentText: extractedText,
    itemUrl: article.link,
  };

  /** The keyword pass; resolves to what the embedding pass needs, or `null` to stop here. */
  const keywordPass = Effect.gen(function* () {
    const explicitLabels = yield* db.use("load explicit item categories", (client) =>
      loadExplicitItemCategoryLabels(client, article.id),
    );
    const explicitLabelSet = new Set(explicitLabels);
    const remainingChipSlots = Math.max(0, MAX_CLASSIFIER_LABELS - explicitLabels.length);

    if (remainingChipSlots === 0) {
      yield* sync([], KEYWORD_EXTRACTED_ITEM_CLASSIFIER_MODEL);
      if (embeddingConfig) {
        yield* sync([], embeddingModelInfo(embeddingConfig));
      }
      return null;
    }

    const maxLabels = remainingChipSlots + explicitLabels.length;
    const keywordInferredLabels = classifyItemCategories(classifierInput, maxLabels)
      .categories.filter((category) => !explicitLabelSet.has(category.label))
      .slice(0, remainingChipSlots);
    // No usable label carries no new information, and these rows share the refresh classifier's
    // model id, so writing an empty set would erase the labels refresh assigned from feed text.
    if (keywordInferredLabels.length > 0) {
      yield* sync(keywordInferredLabels, KEYWORD_EXTRACTED_ITEM_CLASSIFIER_MODEL);
    }
    return { explicitLabelSet, remainingChipSlots, maxLabels };
  }).pipe(
    Effect.catchTag("DatabaseError", (error) =>
      warnFailed(KEYWORD_CLASSIFIER_METHOD)(error).pipe(Effect.as(null)),
    ),
  );

  const plan = yield* keywordPass;
  if (!plan || !embeddingConfig) {
    return;
  }

  const embeddingModel = embeddingModelInfo(embeddingConfig);
  yield* Effect.gen(function* () {
    const classification = yield* Effect.tryPromise({
      try: () => classifyItemEmbedding(classifierInput, embeddingConfig, plan.maxLabels),
      catch: (cause) => new UpstreamError({ operation: "classify item embedding", cause }),
    });
    const inferredCategoryLabels = classification.categories
      .filter((category) => !plan.explicitLabelSet.has(category.label))
      .slice(0, plan.remainingChipSlots);
    // Same as the keyword pass: no usable label keeps the labels refresh already wrote.
    if (inferredCategoryLabels.length > 0) {
      yield* sync(inferredCategoryLabels, embeddingModel);
    }
  }).pipe(Effect.catch(warnFailed(embeddingModel.classifierMethod)));
});
