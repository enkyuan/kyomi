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

const apiKey = process.env.VOYAGE_API_KEY;

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
    predictions.push({ case: case_, predicted: result.categories.map((c) => c.label) });
  }
  return predictions;
}

describe.skipIf(!apiKey)("embedding classifier eval (live Voyage API)", () => {
  test("prints scoreboard for the embedding classifier and compares against the keyword baseline", async () => {
    const config: EmbeddingClassifierConfig = { apiKey: apiKey! };
    const predictions = await runEmbeddingClassifier(CLASSIFIER_EVAL_FIXTURE, config);
    const { perCategory, overall } = accumulateConfusion(predictions);

    console.log(`\n${renderScoreboard(perCategory, overall)}\n`);
    console.log(
      `Embedding classifier: F1=${f1(overall).toFixed(3)} P=${precision(overall).toFixed(3)} R=${recall(overall).toFixed(3)}\n` +
        `Keyword classifier (from classifier-eval.test.ts): F1=0.909 P=0.926 R=0.893\n` +
        `Compare these numbers to decide whether to promote the embedding classifier to the ` +
        `default read path, keep both writing in parallel for more data, or revisit the ` +
        `category cards / similarity thresholds.`,
    );

    expect(predictions.length).toBe(CLASSIFIER_EVAL_FIXTURE.length);
  }, 30_000);
});
