import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import {
  classifyItemEmbeddings,
  MAX_CLASSIFIER_LABELS,
  resetPrototypeCache,
  scoreItemEmbeddings,
  type EmbeddingClassifierConfig,
} from "@kyomi/worker";
import { embeddingClassifierConfig } from "@config/embeddings";
import {
  cachedEmbeddingsFetch,
  embeddingsCacheFile,
  embeddingsUpstreamFromEnv,
} from "./embedding-cache";
import {
  accumulateConfusion,
  f1,
  precision,
  recall,
  renderScoreboard,
  round3,
  type Prediction,
} from "./classifier-eval-scoring";
import { CLASSIFIER_EVAL_FIXTURE, type ClassifierEvalCase } from "./classifier-eval-fixture";
import { CLASSIFIER_EVAL_STORED_CASES } from "./classifier-eval-stored-fixture";

/**
 * Live eval of the embedding classifier as production configures it for the Cloudflare BGE-M3
 * Worker: the provider's own cutoffs and secondary-label margin from `embeddingClassifierConfig`,
 * and MAX_CLASSIFIER_LABELS chip slots. Runs when the Worker credentials are set or the offline
 * embeddings cache (see embedding-cache.ts) already holds every text, and is skipped otherwise.
 *
 * The floors are a ratchet against a model, head, card, or rule change that silently mislabels or
 * stops labeling articles: the earlier 0.6 card cutoff, for example, left 99% of stored articles
 * unlabeled under BGE-M3. Raise them when a change genuinely improves the scores.
 */

const upstream = embeddingsUpstreamFromEnv();
const cacheFile = embeddingsCacheFile("eval");
const enabled = Boolean(upstream) || existsSync(cacheFile);
const config = embeddingClassifierConfig(undefined, {
  CLOUDFLARE_EMBEDDINGS_URL: upstream?.url ?? "https://embeddings-cache.invalid/embed",
  CLOUDFLARE_EMBEDDINGS_TOKEN: upstream?.token ?? "embeddings-cache",
}) as EmbeddingClassifierConfig;

const FLOORS = {
  stored: { f1: 0.65, maxAbstention: 0.15, clearTop1: 0.78 },
  // Synthetic headlines written against the category cards; the head learned from real articles.
  regression: { f1: 0.6 },
  field: { f1: 0.65 },
};

const originalFetch = globalThis.fetch;

async function runEmbeddingClassifier(cases: readonly ClassifierEvalCase[]): Promise<Prediction[]> {
  const inputs = cases.map((case_) => ({ ...case_, maxLabels: MAX_CLASSIFIER_LABELS }));
  const [classifications, scores] = await Promise.all([
    classifyItemEmbeddings(inputs, config),
    scoreItemEmbeddings(inputs, config),
  ]);
  return cases.map((case_) => {
    const predicted = (classifications.get(case_.id)?.categories ?? []).map((c) => c.label);
    if ([...case_.expected].sort().join("|") !== [...predicted].sort().join("|")) {
      const top3 = (scores.get(case_.id) ?? [])
        .slice(0, 3)
        .map((entry) => `${entry.label}=${entry.score.toFixed(3)}`)
        .join(", ");
      console.log(
        `[mismatch] ${case_.id}: expected ${case_.expected.join(", ") || "none"}; predicted ${predicted.join(", ") || "none"}; top3 ${top3}`,
      );
    }
    return { case: case_, predicted };
  });
}

function report(name: string, predictions: readonly Prediction[]) {
  const { perCategory, overall } = accumulateConfusion(predictions);
  const abstention =
    predictions.filter((prediction) => prediction.predicted.length === 0).length /
    predictions.length;
  console.log(`\n${name}\n${renderScoreboard(perCategory, overall)}`);
  console.log(
    `${name}: F1=${round3(f1(overall))} P=${round3(precision(overall))} R=${round3(recall(overall))} abstain=${round3(abstention)}`,
  );
  return { f1: f1(overall), abstention };
}

beforeAll(() => {
  globalThis.fetch = cachedEmbeddingsFetch({ cacheFile, upstream, realFetch: originalFetch });
  resetPrototypeCache();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  resetPrototypeCache();
});

describe.skipIf(!enabled)("embedding classifier eval (Cloudflare BGE-M3)", () => {
  test("labels stored articles above the floors", async () => {
    const result = report(
      "Stored articles",
      await runEmbeddingClassifier(CLASSIFIER_EVAL_STORED_CASES),
    );

    expect(result.f1).toBeGreaterThanOrEqual(FLOORS.stored.f1);
    expect(result.abstention).toBeLessThanOrEqual(FLOORS.stored.maxAbstention);
  }, 120_000);

  test("puts an expected category first for clearly labeled stored articles", async () => {
    const clear = CLASSIFIER_EVAL_STORED_CASES.filter(
      (case_) => case_.expected.length > 0 && !case_.needsReview,
    );
    const scores = await scoreItemEmbeddings(clear, config);
    const top1 =
      clear.filter((case_) => case_.expected.includes(scores.get(case_.id)?.[0]?.label ?? ""))
        .length / clear.length;
    console.log(`Clearly labeled stored articles (${clear.length}): top-1 ${round3(top1)}`);

    expect(top1).toBeGreaterThanOrEqual(FLOORS.stored.clearTop1);
  }, 120_000);

  test("keeps regression and coverage cases above their floor", async () => {
    const result = report(
      "Regression + coverage cases",
      await runEmbeddingClassifier(CLASSIFIER_EVAL_FIXTURE.filter((c) => c.source !== "field")),
    );

    expect(result.f1).toBeGreaterThanOrEqual(FLOORS.regression.f1);
  }, 120_000);

  test("keeps held-out field cases above their floor", async () => {
    // Never tuned on: the cutoffs were chosen on stored articles only.
    const result = report(
      "Held-out field cases",
      await runEmbeddingClassifier(CLASSIFIER_EVAL_FIXTURE.filter((c) => c.source === "field")),
    );

    expect(result.f1).toBeGreaterThanOrEqual(FLOORS.field.f1);
  }, 120_000);
});
