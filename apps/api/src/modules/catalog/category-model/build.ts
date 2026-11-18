import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Clock, Effect } from "effect";
import { eq, inArray, sql } from "drizzle-orm";
import {
  CANONICAL_CATEGORY_LABELS,
  feedItems,
  feeds,
  MISCELLANEOUS_CATEGORY_LABEL,
} from "@kyomi/db";
import {
  encodeCategoryModel,
  NO_CATEGORY_CLASS,
  type CategoryModel,
  type EmbeddingClassifierConfig,
} from "@kyomi/ingest";
import { Db } from "@adapters/db/service";
import { CatalogFileError, TrainingDataIncomplete, TrainingFailed } from "../errors";
import { Embeddings } from "../embeddings";
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
// The generated module lives in `@kyomi/ingest`; locating it from the package's resolved entry
// point keeps the path independent of where this file sits in the tree.
const WEIGHTS_MODULE_PATH = fileURLToPath(
  new URL("services/feed/category-model-weights.ts", import.meta.resolve("@kyomi/ingest")),
);
const EMBED_BATCH = 256;
const ARTICLE_QUERY_BATCH = 1000;

export const loadTrainingLabels = Effect.try({
  try: () => JSON.parse(readFileSync(TRAINING_LABELS_PATH, "utf8")) as TrainingLabel[],
  catch: (cause) => new CatalogFileError({ path: TRAINING_LABELS_PATH, cause }),
});

/**
 * Loads the labeled articles from the database. Uses the text extraction re-classifies from when
 * it is ready and the feed's own text otherwise, the same text the head is applied to.
 */
const loadTrainingArticles = Effect.fn("catalog.train.loadArticles")(function* (
  ids: readonly string[],
) {
  const db = yield* Db;
  const rows = [];
  for (let start = 0; start < ids.length; start += ARTICLE_QUERY_BATCH) {
    rows.push(
      ...(yield* db.use("catalog.train.loadArticles", async (client) =>
        client
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
          .where(inArray(feedItems.id, ids.slice(start, start + ARTICLE_QUERY_BATCH))),
      )),
    );
  }
  return rows.map((row) => ({ ...row, feedTitle: row.feedTitle ?? "", sourceKind: "rss" }));
});

/**
 * Writes the module beside the target and renames it into place, so an interrupted or concurrent
 * build never leaves the worker importing a truncated module; the last finished build wins.
 */
const writeWeightsModule = Effect.fn("catalog.train.writeWeights")(function* (source: string) {
  const stamp = yield* Clock.currentTimeMillis;
  const temporaryPath = `${WEIGHTS_MODULE_PATH}.${process.pid}.${stamp}.tmp`;
  yield* Effect.try({
    try: () => {
      writeFileSync(temporaryPath, source);
      renameSync(temporaryPath, WEIGHTS_MODULE_PATH);
    },
    catch: (cause) => new CatalogFileError({ path: WEIGHTS_MODULE_PATH, cause }),
  });
});

/**
 * Embeds the labeled articles, cross-validates, trains the head on all of them, and writes it as
 * the worker's weights module.
 */
export const buildCategoryModel = Effect.fn("catalog.train.build")(function* (input: {
  config: EmbeddingClassifierConfig;
  labels: readonly string[];
  version: string;
  options: TrainingOptions;
}) {
  const embeddings = yield* Embeddings;
  const trainingLabels = yield* loadTrainingLabels;
  const articles = yield* loadTrainingArticles(trainingLabels.map((label) => label.id));
  // A database without some labeled articles (a partial local copy, a restore, a prune) would
  // train a head on a skewed subset and still overwrite the committed weights, so refuse first.
  const loaded = new Set(articles.map((article) => article.id));
  const missingIds = trainingLabels.map((label) => label.id).filter((id) => !loaded.has(id));
  if (missingIds.length > 0) {
    return yield* new TrainingDataIncomplete({
      message: `${missingIds.length} of ${trainingLabels.length} labeled training articles are not in this database (first: ${missingIds.slice(0, 5).join(", ")}); train against a database that has all of them`,
    });
  }
  const vectors = new Map<string, number[]>();
  for (let start = 0; start < articles.length; start += EMBED_BATCH) {
    const batch = yield* embeddings.embedItems(
      articles.slice(start, start + EMBED_BATCH),
      input.config,
    );
    for (const [id, vector] of batch) {
      vectors.set(id, vector);
    }
  }
  // embedItemVectors keeps the batches that succeed; a model trained on that subset would ship
  // silently skewed, so a build needs every loaded article embedded.
  const unembedded = articles.length - vectors.size;
  if (unembedded > 0) {
    return yield* new TrainingDataIncomplete({
      message: `${unembedded} of ${articles.length} training articles failed to embed; retry the build`,
    });
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
  // The trainers are pure CPU code that reject bad input by throwing; the build owns that edge.
  const { report, model } = yield* Effect.try({
    try: () => ({
      report: crossValidateCategoryModel(examples, input.labels, input.options),
      model: trainCategoryModel(examples, input.labels, input.version, input.options),
    }),
    catch: (cause) => new TrainingFailed({ cause }),
  });
  yield* writeWeightsModule(renderWeightsModule(model, examples.length, input.options));
  return {
    model,
    report,
    examples: examples.length,
  } satisfies { model: CategoryModel; report: CrossValidationReport; examples: number };
});

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
