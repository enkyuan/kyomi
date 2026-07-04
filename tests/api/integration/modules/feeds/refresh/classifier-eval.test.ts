import { describe, expect, test } from "bun:test";
import { classifyFeedItemCategories } from "@kyomi/worker";
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

/**
 * Classifier evaluation harness. Runs the fixture against the current item-level classifier
 * and reports precision, recall, and F1 per canonical category plus an aggregate. Locks in
 * a per-classifier baseline so a future implementation (embedding-based, LLM, whatever)
 * cannot silently regress — the assertion at the bottom is the ratchet: if you swap in a
 * classifier that scores worse than these numbers on this fixture, this test fails.
 *
 * When intentionally raising the floor (a better classifier has landed), update the
 * baseline in one place: `CURRENT_BASELINE` at the bottom of this file. Do NOT lower the
 * baseline to make a regressing change pass. Scoring math lives in `classifier-eval-scoring.ts`,
 * shared with `classifier-eval-embedding.test.ts` so both classifiers report numbers the same
 * way and are directly comparable.
 */

function runClassifier(cases: readonly ClassifierEvalCase[]): Prediction[] {
  return cases.map((case_) => {
    const result = classifyFeedItemCategories({
      feedTitle: case_.feedTitle,
      feedDescription: case_.feedDescription,
      feedUrl: case_.feedUrl,
      feedSiteUrl: case_.feedSiteUrl,
      sourceKind: case_.sourceKind,
      itemTitle: case_.itemTitle,
      itemSummary: case_.itemSummary,
      itemContentText: case_.itemContentText,
      itemUrl: case_.itemUrl,
    });
    return {
      case: case_,
      predicted: result.categories.map((category) => category.label),
    };
  });
}

describe("classifier eval harness", () => {
  const predictions = runClassifier(CLASSIFIER_EVAL_FIXTURE);
  const { perCategory, overall } = accumulateConfusion(predictions);

  test("prints scoreboard for the current classifier", () => {
    // Not an assertion — this exists so the score table appears in `bun test` output next to
    // the ratchet assertions below, making it easy to see WHY a floor bump is (or isn't)
    // warranted when swapping classifiers.
    console.log(`\n${renderScoreboard(perCategory, overall)}\n`);
    expect(predictions.length).toBe(CLASSIFIER_EVAL_FIXTURE.length);
  });

  test("session-regression cases all pass exactly", () => {
    // Regressions are non-negotiable: each one traces to a real user-visible bug that was
    // fixed in-session. A classifier that gets these wrong is shipping the old bug back.
    const failures: string[] = [];
    for (const { case: case_, predicted } of predictions) {
      if (case_.source !== "regression") continue;
      const expected = [...case_.expected].sort();
      const got = [...predicted].sort();
      if (expected.length !== got.length || expected.some((label, i) => label !== got[i])) {
        failures.push(
          `  ${case_.id}: expected [${expected.join(", ")}], got [${got.join(", ")}]${
            case_.note ? `\n    (${case_.note})` : ""
          }`,
        );
      }
    }
    if (failures.length > 0) {
      throw new Error(
        `Session-regression fixture failures:\n${failures.join("\n")}\n\n` +
          `These cases lock in prior fixes; do not change fixture expectations to make them pass.`,
      );
    }
  });

  // ── Baseline ratchet ───────────────────────────────────────────────────────
  //
  // Snapshot of the CURRENT keyword classifier's performance on this fixture. When you swap
  // in a better classifier, update these numbers up (never down) in the same PR. When you
  // add fixture cases, re-run and adjust; the git history of this constant is the record
  // of "how good has the classifier gotten over time."
  //
  // The overall F1 threshold is deliberately below the measured baseline by a small
  // tolerance so trivial fixture edits (adding a hard case) don't require a floor edit,
  // but a real regression (dropping many cases) does trigger a failure.
  // Measured on the keyword classifier as of this fixture commit: F1=0.909, P=0.926, R=0.893.
  // Floors sit ~5 F1 points below to absorb small fixture growth (adding hard cases nudges
  // recall down transiently) without demanding a floor bump in the same PR, while still
  // catching a real regression (e.g. flipping a strong keyword back to `weakKeywords` and
  // dropping several correct items).
  const CURRENT_BASELINE = {
    overallF1Floor: 0.85,
    overallPrecisionFloor: 0.88,
    overallRecallFloor: 0.82,
  };

  test("overall F1 stays at or above the baseline floor", () => {
    expect(round3(f1(overall))).toBeGreaterThanOrEqual(CURRENT_BASELINE.overallF1Floor);
  });

  test("overall precision stays at or above the baseline floor", () => {
    expect(round3(precision(overall))).toBeGreaterThanOrEqual(
      CURRENT_BASELINE.overallPrecisionFloor,
    );
  });

  test("overall recall stays at or above the baseline floor", () => {
    expect(round3(recall(overall))).toBeGreaterThanOrEqual(CURRENT_BASELINE.overallRecallFloor);
  });
});
