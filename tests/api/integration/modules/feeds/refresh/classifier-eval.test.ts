import { describe, expect, test } from "bun:test";
import { CANONICAL_CATEGORY_LABELS } from "@kyomi/db";
import { classifyFeedItemCategories } from "@kyomi/worker";
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
 * baseline to make a regressing change pass.
 */

type Prediction = {
  case: ClassifierEvalCase;
  predicted: readonly string[];
};

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

type Confusion = { tp: number; fp: number; fn: number };

function emptyConfusion(): Confusion {
  return { tp: 0, fp: 0, fn: 0 };
}

/**
 * Multi-label per-category confusion:
 * - True positive: label ∈ expected AND label ∈ predicted
 * - False positive: label ∈ predicted AND label ∉ expected
 * - False negative: label ∈ expected AND label ∉ predicted
 * The "abstain" case (expected = []) contributes only to false positives when the
 * classifier predicts anything, which is what we want — spurious labels are the failure
 * mode weakKeyword demotions were meant to fix.
 */
function accumulateConfusion(predictions: readonly Prediction[]): {
  perCategory: Map<string, Confusion>;
  overall: Confusion;
} {
  const perCategory = new Map<string, Confusion>();
  for (const label of CANONICAL_CATEGORY_LABELS) {
    perCategory.set(label, emptyConfusion());
  }
  const overall = emptyConfusion();

  for (const { case: case_, predicted } of predictions) {
    const expectedSet = new Set(case_.expected);
    const predictedSet = new Set(predicted);
    for (const label of CANONICAL_CATEGORY_LABELS) {
      const bucket = perCategory.get(label)!;
      const isExpected = expectedSet.has(label);
      const isPredicted = predictedSet.has(label);
      if (isExpected && isPredicted) {
        bucket.tp += 1;
        overall.tp += 1;
      } else if (!isExpected && isPredicted) {
        bucket.fp += 1;
        overall.fp += 1;
      } else if (isExpected && !isPredicted) {
        bucket.fn += 1;
        overall.fn += 1;
      }
    }
  }
  return { perCategory, overall };
}

function precision({ tp, fp }: Confusion): number {
  if (tp + fp === 0) return 1;
  return tp / (tp + fp);
}

function recall({ tp, fn }: Confusion): number {
  if (tp + fn === 0) return 1;
  return tp / (tp + fn);
}

function f1(confusion: Confusion): number {
  const p = precision(confusion);
  const r = recall(confusion);
  if (p + r === 0) return 0;
  return (2 * p * r) / (p + r);
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function renderScoreboard(perCategory: Map<string, Confusion>, overall: Confusion): string {
  const lines: string[] = [];
  lines.push("category                     tp  fp  fn      P      R     F1");
  lines.push("-".repeat(66));
  for (const label of CANONICAL_CATEGORY_LABELS) {
    const c = perCategory.get(label)!;
    if (c.tp + c.fp + c.fn === 0) continue;
    lines.push(
      [
        label.padEnd(28),
        String(c.tp).padStart(3),
        String(c.fp).padStart(3),
        String(c.fn).padStart(3),
        round3(precision(c)).toFixed(3).padStart(6),
        round3(recall(c)).toFixed(3).padStart(6),
        round3(f1(c)).toFixed(3).padStart(6),
      ].join(" "),
    );
  }
  lines.push("-".repeat(66));
  lines.push(
    [
      "OVERALL".padEnd(28),
      String(overall.tp).padStart(3),
      String(overall.fp).padStart(3),
      String(overall.fn).padStart(3),
      round3(precision(overall)).toFixed(3).padStart(6),
      round3(recall(overall)).toFixed(3).padStart(6),
      round3(f1(overall)).toFixed(3).padStart(6),
    ].join(" "),
  );
  return lines.join("\n");
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
