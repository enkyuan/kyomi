import { CANONICAL_CATEGORY_LABELS } from "@kyomi/db";
import type { ClassifierEvalCase } from "./classifier-eval-fixture";

/**
 * Classifier-agnostic scoring for the eval fixture: given any classifier's predicted labels
 * per fixture case, compute per-category and overall precision/recall/F1. Shared between the
 * keyword classifier's eval test and the embedding classifier's eval test so both report
 * numbers the exact same way and are directly comparable.
 */

export type Prediction = {
  case: ClassifierEvalCase;
  predicted: readonly string[];
};

export type Confusion = { tp: number; fp: number; fn: number };

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
export function accumulateConfusion(predictions: readonly Prediction[]): {
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

export function precision({ tp, fp }: Confusion): number {
  if (tp + fp === 0) return 1;
  return tp / (tp + fp);
}

export function recall({ tp, fn }: Confusion): number {
  if (tp + fn === 0) return 1;
  return tp / (tp + fn);
}

export function f1(confusion: Confusion): number {
  const p = precision(confusion);
  const r = recall(confusion);
  if (p + r === 0) return 0;
  return (2 * p * r) / (p + r);
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function renderScoreboard(perCategory: Map<string, Confusion>, overall: Confusion): string {
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
