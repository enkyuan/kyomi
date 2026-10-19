import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  CANONICAL_CATEGORY_LABELS,
  feedItems,
  feeds,
  MISCELLANEOUS_CATEGORY_LABEL,
} from "@kyomi/db";
import {
  embedItemVectors,
  encodeCategoryModel,
  NO_CATEGORY_CLASS,
  type CategoryModel,
  type EmbeddingClassifierConfig,
} from "@kyomi/worker";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@adapters/db/client";
import {
  crossValidateCategoryModel,
  trainCategoryModel,
  type CrossValidationReport,
  type TrainingOptions,
} from "./train";

/** The canonical categories plus the abstain class; Miscellaneous is a fallback, not a topic. */
export const CATEGORY_MODEL_LABELS: readonly string[] = [
  ...CANONICAL_CATEGORY_LABELS.filter((label) => label !== MISCELLANEOUS_CATEGORY_LABEL),
  NO_CATEGORY_CLASS,
];

/**
 * Chosen by 5-fold cross-validation grouped by feed over the training articles: balanced classes
 * with this L2 penalty scored best on top-1 accuracy and out-of-fold F1 among 1e-5 to 1e-3.
 */
export const CATEGORY_MODEL_TRAINING_OPTIONS: TrainingOptions = {
  epochs: 300,
  learningRate: 0.05,
  l2: 3e-4,
  balanceClasses: true,
};

/** One drafted label per training article, keyed by `feed_items.id`. */
export type TrainingLabel = {
  id: string;
  primary: string;
  secondary: string | null;
  needsReview: boolean;
};

const TRAINING_LABELS_PATH = resolve(import.meta.dir, "training-labels.json");
const WEIGHTS_MODULE_PATH = resolve(
  import.meta.dir,
  "../../../../../../packages/worker/src/services/feed/category-model-weights.ts",
);
const EMBED_BATCH = 256;

export function loadTrainingLabels(): TrainingLabel[] {
  return JSON.parse(readFileSync(TRAINING_LABELS_PATH, "utf8")) as TrainingLabel[];
}

/**
 * Loads the labeled articles from the database. Uses the text extraction re-classifies from when
 * it is ready and the feed's own text otherwise, the same text the head is applied to.
 */
async function loadTrainingArticles(ids: readonly string[]) {
  const rows = [];
  for (let start = 0; start < ids.length; start += 1000) {
    rows.push(
      ...(await db
        .select({
          id: feedItems.id,
          feedId: feedItems.feedId,
          itemTitle: feedItems.title,
          itemSummary: feedItems.summary,
          itemContentText: sql<string | null>`left(coalesce(
            CASE WHEN ${feedItems.extractedContentStatus} = 'ready' THEN ${feedItems.extractedContentText} END,
            ${feedItems.contentText}
          ), 3000)`,
          itemUrl: feedItems.link,
          feedTitle: feeds.title,
          feedDescription: feeds.description,
          feedUrl: feeds.url,
          feedSiteUrl: feeds.link,
        })
        .from(feedItems)
        .innerJoin(feeds, eq(feeds.id, feedItems.feedId))
        .where(inArray(feedItems.id, ids.slice(start, start + 1000)))),
    );
  }
  return rows.map((row) => ({ ...row, feedTitle: row.feedTitle ?? "", sourceKind: "rss" }));
}

/**
 * Embeds the labeled articles, cross-validates, trains the head on all of them, and writes it as
 * the worker's weights module.
 */
export async function buildCategoryModel(input: {
  config: EmbeddingClassifierConfig;
  labels: readonly string[];
  version: string;
  options: TrainingOptions;
}): Promise<{
  model: CategoryModel;
  report: CrossValidationReport;
  examples: number;
  missing: number;
}> {
  const trainingLabels = loadTrainingLabels();
  const articles = await loadTrainingArticles(trainingLabels.map((label) => label.id));
  const vectors = new Map<string, number[]>();
  for (let start = 0; start < articles.length; start += EMBED_BATCH) {
    const batch = await embedItemVectors(articles.slice(start, start + EMBED_BATCH), input.config);
    for (const [id, vector] of batch) {
      vectors.set(id, vector);
    }
  }
  // embedItemVectors keeps the batches that succeed; a model trained on that subset would ship
  // silently skewed, so a build needs every loaded article embedded.
  const unembedded = articles.length - vectors.size;
  if (unembedded > 0) {
    throw new Error(
      `${unembedded} of ${articles.length} training articles failed to embed; retry the build`,
    );
  }
  const feedIdOf = new Map(articles.map((article) => [article.id, article.feedId]));
  const examples = trainingLabels.flatMap((label) => {
    const vector = vectors.get(label.id);
    return vector
      ? [
          {
            vector,
            label: label.primary,
            feedId: feedIdOf.get(label.id)!,
            expected: [label.primary, label.secondary].filter(
              (value): value is string => value !== null && value !== NO_CATEGORY_CLASS,
            ),
            needsReview: label.needsReview,
          },
        ]
      : [];
  });
  const report = crossValidateCategoryModel(examples, input.labels, input.options);
  const model = trainCategoryModel(examples, input.labels, input.version, input.options);
  writeFileSync(WEIGHTS_MODULE_PATH, renderWeightsModule(model, examples.length, input.options));
  return {
    model,
    report,
    examples: examples.length,
    missing: trainingLabels.length - articles.length,
  };
}

function renderWeightsModule(
  model: CategoryModel,
  examples: number,
  options: TrainingOptions,
): string {
  const encoded = encodeCategoryModel(model);
  return `// Generated by \`bun run --cwd apps/api category:train\`; do not edit by hand.
// Softmax head over BGE-M3 article vectors: ${examples} labeled articles, ${model.labels.length} classes
// ("${NO_CATEGORY_CLASS}" abstains), ${JSON.stringify(options)}.
import type { EncodedCategoryModel } from "./category-model";

export const CATEGORY_MODEL_WEIGHTS: EncodedCategoryModel = {
  version: ${JSON.stringify(encoded.version)},
  labels: ${JSON.stringify(encoded.labels)},
  dimensions: ${encoded.dimensions},
  bias: ${JSON.stringify(encoded.bias)},
  weights:
    ${JSON.stringify(encoded.weights)},
};
`;
}
