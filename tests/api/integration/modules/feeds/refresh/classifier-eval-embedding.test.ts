import { describe, expect, test } from "bun:test";
import { classifyItemEmbedding, type EmbeddingClassifierConfig } from "@kyomi/worker";
import {
  accumulateConfusion,
  f1,
  precision,
  recall,
  renderScoreboard,
  type Prediction,
} from "./classifier-eval-scoring";
import { CLASSIFIER_EVAL_FIXTURE, type ClassifierEvalCase } from "./classifier-eval-fixture";

// BGE M3

/**
 * Live comparison of the embedding classifier against the same fixture the keyword
 * classifier is scored against in `classifier-eval.test.ts`. This makes real Voyage API
 * calls, so it's skipped entirely unless `VOYAGE_API_KEY` is set — CI stays green without a
 * key, and this becomes runnable the moment a key is configured (locally or as a CI secret).
 *
 * This test deliberately has NO baseline-floor assertion: it exists to print a scoreboard
 * for side-by-side comparison, not to gate merges. The decision to promote the embedding
 * classifier to the default (or to keep it parallel-write-only) is a product/engineering
 * call made by reading this scoreboard against classifier-eval.test.ts's, not an automated
 * pass/fail.
 */

const apiUrl = process.env.CLOUDFLARE_EMBEDDINGS_URL?.trim();
const apiKey = process.env.CLOUDFLARE_EMBEDDINGS_TOKEN?.trim();
const hasBgeM3 = Boolean(apiUrl && apiKey);

async function runEmbeddingClassifier(
  cases: readonly ClassifierEvalCase[],
  config: EmbeddingClassifierConfig,
): Promise<Prediction[]> {
  const predictions: Prediction[] = [];

  for (const case_ of cases) {
    const result = await classifyItemEmbedding(
      {
        feedTitle: case_.feedTitle,
        feedDescription: case_.feedDescription,
        feedUrl: case_.feedUrl,
        feedSiteUrl: case_.feedSiteUrl,
        sourceKind: case_.sourceKind,
        itemTitle: case_.itemTitle,
        itemSummary: case_.itemSummary,
        itemContentText: case_.itemContentText,
        itemUrl: case_.itemUrl,
      },
      config,
    );

    const predicted = result.categories.map((category) => category.label);
    const expected = [...case_.expected].sort();
    const actual = [...predicted].sort();

    if (case_.id === "field-bandwagon-awit-awards") {
      const debug = await classifyItemEmbedding(
        {
          feedTitle: case_.feedTitle,
          feedDescription: case_.feedDescription,
          feedUrl: case_.feedUrl,
          feedSiteUrl: case_.feedSiteUrl,
          sourceKind: case_.sourceKind,
          itemTitle: case_.itemTitle,
          itemSummary: case_.itemSummary,
          itemContentText: case_.itemContentText,
          itemUrl: case_.itemUrl,
        },
        { ...config, itemSimilarityThreshold: 0 },
        3,
      );

      console.log(
        `\n[Culture raw top 3] ${case_.id}: ${debug.categories
          .map((category) => `${category.label}=${category.confidence.toFixed(3)}`)
          .join(", ")}`,
      );
    }

    if (expected.join("|") !== actual.join("|")) {
      console.log(
        [
          `\n[BGE-M3 mismatch] ${case_.id}`,
          `Expected: ${expected.join(", ")}`,
          `Predicted: ${actual.join(", ") || "none"}`,
          `Scores: ${
            result.categories
              .map((category) => `${category.label}=${category.confidence.toFixed(3)}`)
              .join(", ") || "none"
          }`,
        ].join("\n"),
      );
    }

    predictions.push({ case: case_, predicted });
  }

  return predictions;
}

describe.skipIf(!hasBgeM3)("embedding classifier eval (live Cloudflare BGE-M3)", () => {
  test("prints scoreboard for the BGE-M3 embedding classifier and compares against the keyword baseline", async () => {
    const config: EmbeddingClassifierConfig = {
      apiKey: apiKey!,
      apiUrl: apiUrl!,
      model: "@cf/baai/bge-m3",
    };
    const predictions = await runEmbeddingClassifier(CLASSIFIER_EVAL_FIXTURE, config);
    const { perCategory, overall } = accumulateConfusion(predictions);

    console.log(`\n${renderScoreboard(perCategory, overall)}\n`);
    console.log(
      `Embedding classifier: F1=${f1(overall).toFixed(3)} P=${precision(overall).toFixed(3)} R=${recall(overall).toFixed(3)}\n` +
        `Run classifier-eval.test.ts separately to compare the current keyword scoreboard.\n` +
        `Compare these numbers to decide whether to promote the embedding classifier to the ` +
        `default read path, keep both writing in parallel for more data, or revisit the ` +
        `category cards / similarity thresholds.`,
    );

    expect(predictions.length).toBe(CLASSIFIER_EVAL_FIXTURE.length);
  }, 60_000);
});
