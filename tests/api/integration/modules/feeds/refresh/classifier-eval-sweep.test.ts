import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  MAX_CLASSIFIER_LABELS,
  resetPrototypeCache,
  scoreFeedEmbedding,
  scoreItemEmbeddings,
  selectCategories,
  type CategoryScore,
  type CategorySelectionRule,
  type EmbeddingClassifierConfig,
} from "@kyomi/worker";
import {
  cachedEmbeddingsFetch,
  embeddingsCacheFile,
  embeddingsUpstreamFromEnv,
} from "./embedding-cache";
import { CLASSIFIER_EVAL_FIXTURE, type ClassifierEvalCase } from "./classifier-eval-fixture";
import { CLASSIFIER_EVAL_STORED_CASES } from "./classifier-eval-stored-fixture";
import {
  accumulateConfusion,
  f1,
  precision,
  recall,
  renderScoreboard,
  round3,
} from "./classifier-eval-scoring";

/**
 * Threshold sweep for the BGE-M3 embedding classifier. Opt-in (`CLASSIFIER_SWEEP=1`) because it
 * prints tables for a human to read instead of asserting. Tunes on the stored-article set only;
 * regression, coverage, and held-out field cases are scored once with the best rule as checks.
 *
 * Optional inputs (JSONL, one object per line, never committed):
 * - CLASSIFIER_SWEEP_FEEDS: feeds with publisher-declared categories, `{ feedTitle,
 *   feedDescription, feedUrl, feedSiteUrl, labels }`, to sweep the feed floor against weak labels.
 * - CLASSIFIER_COVERAGE_SAMPLE: stored articles with their existing labels, to replay the rules
 *   and report how many articles would show no category. CLASSIFIER_SWEEP_RULE ("floor,margin")
 *   adds a rule to that replay and CLASSIFIER_FEED_FLOOR sets its feed floor.
 */

const enabled = process.env.CLASSIFIER_SWEEP === "1";
const upstream = embeddingsUpstreamFromEnv();
const config: EmbeddingClassifierConfig = {
  apiKey: upstream?.token ?? "embeddings-cache",
  apiUrl: upstream?.url ?? "https://embeddings-cache.invalid/embed",
};
// The pre-calibration cutoff, kept as a baseline row in every table.
const PREVIOUS_RULE: CategorySelectionRule = { minSimilarity: 0.6 };
const CHOSEN = process.env.CLASSIFIER_SWEEP_RULE?.split(",").map(Number);
const CHOSEN_RULE: CategorySelectionRule | undefined = CHOSEN && {
  minSimilarity: CHOSEN[0]!,
  secondaryMargin: CHOSEN[1],
};
const FLOORS = Array.from({ length: 41 }, (_, i) => round3(0.3 + i * 0.01));
const MARGINS = [...Array.from({ length: 21 }, (_, i) => round3(i * 0.01)), undefined];

type Scored = { case: ClassifierEvalCase; scores: CategoryScore[] };

type CoverageRow = {
  id: string;
  feedId: string;
  itemTitle: string;
  itemSummary: string | null;
  itemContentText: string | null;
  itemUrl: string | null;
  feedTitle: string;
  feedDescription: string | null;
  feedUrl: string;
  feedSiteUrl: string | null;
  sourceKind: string | null;
  explicitItem: string[];
  keywordItem: string[];
  explicitFeed: string[];
  keywordFeed: string[];
};

const originalFetch = globalThis.fetch;

function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function predict(scored: readonly Scored[], rule: CategorySelectionRule) {
  return scored.map(({ case: case_, scores }) => ({
    case: case_,
    predicted: selectCategories(scores, rule, MAX_CLASSIFIER_LABELS).map((entry) => entry.label),
  }));
}

function summarize(scored: readonly Scored[], rule: CategorySelectionRule) {
  const predictions = predict(scored, rule);
  const { perCategory, overall } = accumulateConfusion(predictions);
  const categoryF1 = [...perCategory.values()].filter((c) => c.tp + c.fn > 0).map((c) => f1(c));
  return {
    rule,
    predictions,
    perCategory,
    overall,
    microF1: f1(overall),
    macroF1: categoryF1.reduce((sum, value) => sum + value, 0) / categoryF1.length,
    abstention: predictions.filter((p) => p.predicted.length === 0).length / predictions.length,
    secondaryRate: predictions.filter((p) => p.predicted.length > 1).length / predictions.length,
  };
}

function describeRule(rule: CategorySelectionRule): string {
  return `floor ${rule.minSimilarity.toFixed(2)} margin ${rule.secondaryMargin?.toFixed(2) ?? "none"}`;
}

function row(summary: ReturnType<typeof summarize>): string {
  return [
    describeRule(summary.rule).padEnd(26),
    round3(precision(summary.overall)).toFixed(3),
    round3(recall(summary.overall)).toFixed(3),
    round3(summary.microF1).toFixed(3),
    round3(summary.macroF1).toFixed(3),
    round3(summary.abstention).toFixed(3),
    round3(summary.secondaryRate).toFixed(3),
  ].join("  ");
}

function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}

// Embeds feed texts in one batched call first, so scoring feeds one at a time reads the cache
// instead of sending one request per feed. Mirrors the classifier's title-and-description text.
async function prewarmFeedTexts(
  feeds: ReadonlyArray<{ feedTitle: string; feedDescription: string | null }>,
): Promise<void> {
  const texts = feeds.map((feed) =>
    [feed.feedTitle, feed.feedDescription].filter(Boolean).join(". "),
  );
  await globalThis.fetch(config.apiUrl!, {
    method: "POST",
    body: JSON.stringify({ input: texts.filter(Boolean) }),
  });
}

async function scoreCases(cases: readonly ClassifierEvalCase[]): Promise<Scored[]> {
  const scores = await scoreItemEmbeddings(cases, config);
  return cases.map((case_) => ({ case: case_, scores: scores.get(case_.id) ?? [] }));
}

beforeAll(() => {
  globalThis.fetch = cachedEmbeddingsFetch({
    cacheFile: embeddingsCacheFile("eval"),
    upstream,
    realFetch: originalFetch,
  });
  resetPrototypeCache();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
  resetPrototypeCache();
});

describe.skipIf(!enabled)("embedding classifier threshold sweep (BGE-M3)", () => {
  let best: ReturnType<typeof summarize>;

  test("sweeps the item floor and secondary margin on stored articles", async () => {
    const stored = await scoreCases(CLASSIFIER_EVAL_STORED_CASES);
    expect(stored.every((entry) => entry.scores.length > 0)).toBe(true);

    const top3Path = join(dirname(embeddingsCacheFile("eval")), "top3-stored.jsonl");
    writeFileSync(
      top3Path,
      stored
        .map(({ case: case_, scores }) =>
          JSON.stringify({
            id: case_.id,
            expected: case_.expected,
            top3: scores.slice(0, 3).map((s) => ({ label: s.label, score: round3(s.score) })),
          }),
        )
        .join("\n"),
    );
    const top1 = (filter: (c: ClassifierEvalCase) => boolean) =>
      stored.filter((s) => filter(s.case)).map((s) => s.scores[0]!.score);
    const labeled = top1((c) => c.expected.length > 0);
    const abstain = top1((c) => c.expected.length === 0);
    const gaps = stored.map((s) => s.scores[0]!.score - s.scores[1]!.score);
    console.log(`\nRaw top-3 cosines written to ${top3Path}`);
    for (const [name, values] of [
      ["top-1 (labeled articles)", labeled],
      ["top-1 (abstain articles)", abstain],
      ["top-1 minus top-2", gaps],
    ] as const) {
      console.log(
        `${name.padEnd(26)} p10 ${percentile(values, 0.1).toFixed(3)}  p50 ${percentile(values, 0.5).toFixed(3)}  p90 ${percentile(values, 0.9).toFixed(3)}`,
      );
    }
    const top1Hit =
      stored.filter((s) => s.case.expected.includes(s.scores[0]!.label)).length /
      stored.filter((s) => s.case.expected.length > 0).length;
    console.log(`top-1 label is an expected label: ${round3(top1Hit)}`);

    const summaries = FLOORS.flatMap((minSimilarity) =>
      MARGINS.map((secondaryMargin) => summarize(stored, { minSimilarity, secondaryMargin })),
    );
    summaries.sort((a, b) => b.microF1 - a.microF1 || a.abstention - b.abstention);
    best = summaries[0]!;
    const header = "rule                        P      R      microF1 macroF1 abstain 2-label";
    console.log(`\nStored articles (${stored.length}), top 15 rules by micro F1\n${header}`);
    for (const summary of summaries.slice(0, 15)) {
      console.log(row(summary));
    }
    console.log(`\nPrevious rule\n${header}\n${row(summarize(stored, PREVIOUS_RULE))}`);
    for (const secondaryMargin of [undefined, 0.02, 0.04, 0.06]) {
      const byFloor = summaries
        .filter((s) => s.rule.secondaryMargin === secondaryMargin)
        .sort((a, b) => a.rule.minSimilarity - b.rule.minSimilarity)
        .filter((_, index) => index % 5 === 0);
      console.log(`\nFloor sweep, margin ${secondaryMargin ?? "none"}\n${header}`);
      for (const summary of byFloor) {
        console.log(row(summary));
      }
    }
    for (const rule of [best.rule, ...(CHOSEN_RULE ? [CHOSEN_RULE] : [])]) {
      const summary = summarize(stored, rule);
      console.log(
        `\nStored articles, ${describeRule(rule)}\n${renderScoreboard(summary.perCategory, summary.overall)}`,
      );
    }
  }, 300_000);

  test("checks the best rule on regression, coverage, and held-out field cases", async () => {
    for (const [name, cases] of [
      ["Regression + coverage", CLASSIFIER_EVAL_FIXTURE.filter((c) => c.source !== "field")],
      ["Held-out field", CLASSIFIER_EVAL_FIXTURE.filter((c) => c.source === "field")],
    ] as const) {
      const scored = await scoreCases(cases);
      for (const rule of [PREVIOUS_RULE, best.rule, ...(CHOSEN_RULE ? [CHOSEN_RULE] : [])]) {
        const summary = summarize(scored, rule);
        console.log(
          `\n${name} (${cases.length}), ${describeRule(rule)}: P ${round3(precision(summary.overall))} R ${round3(recall(summary.overall))} F1 ${round3(summary.microF1)} abstain ${round3(summary.abstention)}`,
        );
      }
    }
  }, 300_000);

  test.skipIf(!process.env.CLASSIFIER_SWEEP_FEEDS)(
    "sweeps the feed floor against publisher-declared categories",
    async () => {
      const feeds = readJsonl<{
        feedTitle: string;
        feedDescription: string | null;
        feedUrl: string;
        feedSiteUrl: string | null;
        labels: string[];
      }>(process.env.CLASSIFIER_SWEEP_FEEDS!);
      await prewarmFeedTexts(feeds);
      const scored = [];
      for (const feed of feeds) {
        scored.push({
          labels: feed.labels,
          scores: await scoreFeedEmbedding({ ...feed, sourceKind: "rss" }, config),
        });
      }
      console.log(
        `\nFeeds (${feeds.length}) with publisher categories (weak labels)\nfloor  top-1 hit when labeled  labeled share`,
      );
      for (const minSimilarity of FLOORS.filter((_, index) => index % 2 === 0)) {
        const picked = scored.map((feed) => ({
          labels: feed.labels,
          selected: selectCategories(feed.scores, { minSimilarity }, MAX_CLASSIFIER_LABELS),
        }));
        const labeled = picked.filter((feed) => feed.selected.length > 0);
        const hits = labeled.filter((feed) => feed.labels.includes(feed.selected[0]!.label));
        console.log(
          `${minSimilarity.toFixed(2)}   ${round3(hits.length / Math.max(1, labeled.length)).toFixed(3)}                    ${round3(labeled.length / picked.length).toFixed(3)}`,
        );
      }
    },
    300_000,
  );

  test.skipIf(!process.env.CLASSIFIER_COVERAGE_SAMPLE)(
    "replays the rules over stored articles to measure coverage",
    async () => {
      globalThis.fetch = cachedEmbeddingsFetch({
        cacheFile: embeddingsCacheFile("coverage"),
        upstream,
        realFetch: originalFetch,
      });
      const rows = readJsonl<CoverageRow>(process.env.CLASSIFIER_COVERAGE_SAMPLE!);
      const itemScores = await scoreItemEmbeddings(rows, config);
      const feedRows = [...new Map(rows.map((r) => [r.feedId, r])).values()];
      const feedScores = new Map<string, CategoryScore[]>();
      await prewarmFeedTexts(feedRows);
      for (const feed of feedRows) {
        feedScores.set(feed.feedId, await scoreFeedEmbedding(feed, config));
      }

      const report = (
        name: string,
        rule: CategorySelectionRule,
        feedRule: CategorySelectionRule = rule,
      ) => {
        let itemAbstain = 0;
        let unlabeled = 0;
        for (const r of rows) {
          const item = selectCategories(itemScores.get(r.id) ?? [], rule, MAX_CLASSIFIER_LABELS);
          if (item.length === 0) {
            itemAbstain += 1;
          }
          const feed = selectCategories(
            feedScores.get(r.feedId) ?? [],
            feedRule,
            MAX_CLASSIFIER_LABELS,
          );
          // Embedding read mode: explicit item labels, else embedding item labels, else keyword
          // item labels, else the feed's explicit labels, embedding labels, or keyword labels.
          const shown =
            r.explicitItem.length > 0 ||
            item.length > 0 ||
            r.keywordItem.length > 0 ||
            r.explicitFeed.length > 0 ||
            feed.length > 0 ||
            r.keywordFeed.length > 0;
          if (!shown) {
            unlabeled += 1;
          }
        }
        console.log(
          `${name.padEnd(34)} item abstain ${round3(itemAbstain / rows.length).toFixed(3)}  unlabeled at read ${round3(unlabeled / rows.length).toFixed(3)}`,
        );
      };
      const keywordUnlabeled = rows.filter(
        (r) =>
          r.explicitItem.length +
            r.keywordItem.length +
            r.explicitFeed.length +
            r.keywordFeed.length ===
          0,
      ).length;
      console.log(
        `\nCoverage over ${rows.length} stored articles (${feedRows.length} feeds)\n${"keyword read mode".padEnd(34)} unlabeled at read ${round3(keywordUnlabeled / rows.length).toFixed(3)}`,
      );
      report(`embedding, ${describeRule(PREVIOUS_RULE)}`, PREVIOUS_RULE);
      report(`embedding, ${describeRule(best.rule)}`, best.rule);
      if (CHOSEN_RULE) {
        const rule = CHOSEN_RULE;
        const feedFloor = Number(process.env.CLASSIFIER_FEED_FLOOR ?? rule.minSimilarity);
        report(`embedding, ${describeRule(rule)}, feed ${feedFloor.toFixed(2)}`, rule, {
          ...rule,
          minSimilarity: feedFloor,
        });
      }
    },
    1_200_000,
  );
});
