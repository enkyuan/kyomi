import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  MAX_CLASSIFIER_LABELS,
  MISCELLANEOUS_CATEGORY_LABEL,
  scoreFeedEmbedding,
  scoreItemEmbeddings,
  selectCategories,
  DEFAULT_FEED_SELECTION_RULE,
  DEFAULT_ITEM_SELECTION_RULE,
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
 * Rule sweep for the BGE-M3 embedding classifier. Opt-in (`CLASSIFIER_SWEEP=1`) because it prints
 * tables for a human to read instead of asserting. The article rule is chosen by cross-validation
 * on the training articles (`category:train`), never here: this reports how the production rule
 * and its neighbours do on the stored-article set, with regression, coverage, and held-out field
 * cases as further checks.
 *
 * Optional inputs (JSONL, one object per line, never committed):
 * - CLASSIFIER_SWEEP_FEEDS: feeds with publisher-declared categories, `{ feedId, feedTitle,
 *   feedDescription, feedUrl, feedSiteUrl, labels, items }`, where `items` are the feed's recent
 *   articles (`{ id, itemTitle, itemSummary, itemContentText, itemUrl }`, newest first, none from
 *   the head's training labels). Compares scoring the feed text with scoring its articles, and
 *   sweeps the feed rule against those weak labels.
 * - CLASSIFIER_COVERAGE_SAMPLE: stored articles with their existing labels, to replay the rules
 *   and report how many articles would show no category. CLASSIFIER_SWEEP_RULE ("floor,margin")
 *   adds an article rule to every table and to that replay.
 */

const enabled = process.env.CLASSIFIER_SWEEP === "1";
const upstream = embeddingsUpstreamFromEnv();
const config: EmbeddingClassifierConfig = {
  apiKey: upstream?.token ?? "embeddings-cache",
  apiUrl: upstream?.url ?? "https://embeddings-cache.invalid/embed",
};
const PRODUCTION_RULE = DEFAULT_ITEM_SELECTION_RULE;
const CHOSEN = process.env.CLASSIFIER_SWEEP_RULE?.split(",").map(Number);
const CHOSEN_RULE: CategorySelectionRule | undefined = CHOSEN && {
  minSimilarity: CHOSEN[0]!,
  secondaryMargin: CHOSEN[1],
};
// Article and feed rules are both on the head's probability scale.
const FLOORS = Array.from({ length: 56 }, (_, i) => round3(0.05 + i * 0.01));
const MARGINS = [...Array.from({ length: 9 }, (_, i) => round3(i * 0.05)), undefined];
const FEED_FLOORS = Array.from({ length: 9 }, (_, i) => round3(i * 0.05));
const FEED_MARGINS = [0, 0.05, 0.1, 0.2];

type Scored = { case: ClassifierEvalCase; scores: CategoryScore[] };

type FeedRow = {
  feedId: string;
  feedTitle: string;
  feedDescription: string | null;
  feedUrl: string;
  feedSiteUrl: string | null;
  labels: string[];
  items: Array<{
    id: string;
    itemTitle: string;
    itemSummary: string | null;
    itemContentText: string | null;
    itemUrl: string | null;
  }>;
};

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

/** Each category's mean score over several score lists, best first. */
function meanScores(lists: ReadonlyArray<readonly CategoryScore[]>): CategoryScore[] {
  const sums = new Map<string, number>();
  for (const list of lists) {
    for (const entry of list) {
      sums.set(entry.label, (sums.get(entry.label) ?? 0) + entry.score);
    }
  }
  return [...sums]
    .map(([label, sum]) => ({ label, score: sum / lists.length }))
    .sort((a, b) => b.score - a.score);
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
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe.skipIf(!enabled)("embedding classifier threshold sweep (BGE-M3)", () => {
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
    console.log(`\nRaw top-3 scores written to ${top3Path}`);
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
    const header = "rule                        P      R      microF1 macroF1 abstain 2-label";
    console.log(`\nStored articles (${stored.length}), top 15 rules by micro F1\n${header}`);
    for (const summary of summaries.slice(0, 15)) {
      console.log(row(summary));
    }
    console.log(`\nProduction rule\n${header}\n${row(summarize(stored, PRODUCTION_RULE))}`);
    for (const secondaryMargin of [undefined, 0.1, 0.2, 0.3]) {
      const byFloor = summaries
        .filter((s) => s.rule.secondaryMargin === secondaryMargin)
        .sort((a, b) => a.rule.minSimilarity - b.rule.minSimilarity)
        .filter((_, index) => index % 5 === 0);
      console.log(`\nFloor sweep, margin ${secondaryMargin ?? "none"}\n${header}`);
      for (const summary of byFloor) {
        console.log(row(summary));
      }
    }
    for (const rule of [PRODUCTION_RULE, ...(CHOSEN_RULE ? [CHOSEN_RULE] : [])]) {
      const summary = summarize(stored, rule);
      console.log(
        `\nStored articles, ${describeRule(rule)}\n${renderScoreboard(summary.perCategory, summary.overall)}`,
      );
    }
  }, 300_000);

  test("checks the production rule on regression, coverage, and held-out field cases", async () => {
    for (const [name, cases] of [
      ["Regression + coverage", CLASSIFIER_EVAL_FIXTURE.filter((c) => c.source !== "field")],
      ["Held-out field", CLASSIFIER_EVAL_FIXTURE.filter((c) => c.source === "field")],
    ] as const) {
      const scored = await scoreCases(cases);
      for (const rule of [PRODUCTION_RULE, ...(CHOSEN_RULE ? [CHOSEN_RULE] : [])]) {
        const summary = summarize(scored, rule);
        console.log(
          `\n${name} (${cases.length}), ${describeRule(rule)}: P ${round3(precision(summary.overall))} R ${round3(recall(summary.overall))} F1 ${round3(summary.microF1)} abstain ${round3(summary.abstention)}`,
        );
      }
    }
  }, 300_000);

  test.skipIf(!process.env.CLASSIFIER_SWEEP_FEEDS)(
    "compares feed scoring and sweeps the feed rule against publisher-declared categories",
    async () => {
      const feeds = readJsonl<FeedRow>(process.env.CLASSIFIER_SWEEP_FEEDS!);
      const feedInput = (feed: FeedRow) => ({
        feedTitle: feed.feedTitle,
        feedDescription: feed.feedDescription,
        feedUrl: feed.feedUrl,
        feedSiteUrl: feed.feedSiteUrl,
        sourceKind: "rss",
      });
      await prewarmFeedTexts(feeds);
      const textScores = new Map<string, CategoryScore[]>();
      for (const feed of feeds) {
        textScores.set(feed.feedId, await scoreFeedEmbedding(feedInput(feed), config));
      }
      const itemScores = await scoreItemEmbeddings(
        feeds.flatMap((feed) => feed.items.map((item) => ({ ...feedInput(feed), ...item }))),
        config,
      );
      const articleMean = (feed: FeedRow, count: number) =>
        meanScores(
          feed.items
            .slice(0, count)
            .flatMap((item) => (itemScores.has(item.id) ? [itemScores.get(item.id)!] : [])),
        );
      const methods: Array<[string, (feed: FeedRow) => CategoryScore[]]> = [
        ["A: feed text", (feed) => textScores.get(feed.feedId)!],
        ...[5, 20].map((count): [string, (feed: FeedRow) => CategoryScore[]] => [
          `B: mean of ${count} recent articles`,
          (feed) => articleMean(feed, count),
        ]),
        [
          "A+B: mean of A and B@20",
          (feed) => meanScores([textScores.get(feed.feedId)!, articleMean(feed, 20)]),
        ],
      ];

      // Miscellaneous-only feeds can't score a hit: the head has no Miscellaneous class.
      const topical = feeds.filter((feed) => feed.labels.some((l) => l !== "Miscellaneous"));
      const hit = (feed: FeedRow, scores: readonly CategoryScore[]) =>
        scores[0] !== undefined && feed.labels.includes(scores[0].label);
      console.log(
        `\nFeeds (${topical.length} with a topical publisher category, ${feeds.reduce((n, f) => n + f.items.length, 0)} recent articles)\nmethod                        top-1  top-2 any`,
      );
      for (const [name, score] of methods) {
        const scored = topical.map((feed) => ({ feed, scores: score(feed) }));
        const top1 = scored.filter(({ feed, scores }) => hit(feed, scores)).length;
        const top2 = scored.filter(({ feed, scores }) =>
          scores.slice(0, 2).some((entry) => feed.labels.includes(entry.label)),
        ).length;
        console.log(
          `${name.padEnd(30)}${round3(top1 / topical.length).toFixed(3)}  ${round3(top2 / topical.length).toFixed(3)}`,
        );
      }
      const [baseline, ...others] = methods;
      for (const [name, score] of others) {
        const onlyBaseline = topical.filter(
          (feed) => hit(feed, baseline![1](feed)) && !hit(feed, score(feed)),
        ).length;
        const onlyOther = topical.filter(
          (feed) => !hit(feed, baseline![1](feed)) && hit(feed, score(feed)),
        ).length;
        console.log(
          `paired: right only under ${baseline![0]} ${onlyBaseline}, only under ${name} ${onlyOther}`,
        );
      }

      // The production rule: below the floor a feed falls back to Miscellaneous.
      console.log(
        `\nFeed rule on A (${feeds.length} feeds; a fallback is right only for Miscellaneous feeds)\nrule                        labeled  top-1 when labeled  shown top-1 right  2-label  label precision`,
      );
      const feedRules = [
        DEFAULT_FEED_SELECTION_RULE,
        ...FEED_FLOORS.flatMap((minSimilarity) =>
          FEED_MARGINS.map((secondaryMargin) => ({ minSimilarity, secondaryMargin })),
        ),
      ];
      for (const rule of feedRules) {
        let labeled = 0;
        let labeledHits = 0;
        let shownHits = 0;
        let twoLabels = 0;
        let shown = 0;
        let shownRight = 0;
        for (const feed of feeds) {
          const selected = selectCategories(
            textScores.get(feed.feedId)!,
            rule,
            MAX_CLASSIFIER_LABELS,
          ).map((entry) => entry.label);
          const labels = selected.length > 0 ? selected : [MISCELLANEOUS_CATEGORY_LABEL];
          if (selected.length > 0) {
            labeled += 1;
            labeledHits += feed.labels.includes(selected[0]!) ? 1 : 0;
          }
          shownHits += feed.labels.includes(labels[0]!) ? 1 : 0;
          twoLabels += labels.length > 1 ? 1 : 0;
          shown += labels.length;
          shownRight += labels.filter((label) => feed.labels.includes(label)).length;
        }
        console.log(
          [
            describeRule(rule).padEnd(26),
            round3(labeled / feeds.length)
              .toFixed(3)
              .padEnd(7),
            round3(labeledHits / Math.max(1, labeled))
              .toFixed(3)
              .padEnd(18),
            round3(shownHits / feeds.length)
              .toFixed(3)
              .padEnd(17),
            round3(twoLabels / feeds.length)
              .toFixed(3)
              .padEnd(7),
            round3(shownRight / shown).toFixed(3),
          ].join("  "),
        );
      }
    },
    1_200_000,
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

      const report = (name: string, rule: CategorySelectionRule) => {
        let itemAbstain = 0;
        let unlabeled = 0;
        let fromFeed = 0;
        let fromFeedFallback = 0;
        for (const r of rows) {
          const item = selectCategories(itemScores.get(r.id) ?? [], rule, MAX_CLASSIFIER_LABELS);
          if (item.length === 0) {
            itemAbstain += 1;
          }
          const feed = selectCategories(
            feedScores.get(r.feedId) ?? [],
            DEFAULT_FEED_SELECTION_RULE,
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
          // Nothing above the feed's embedding label: the article shows it, and a feed below the
          // feed floor shows the Miscellaneous fallback.
          if (
            r.explicitItem.length + item.length + r.keywordItem.length + r.explicitFeed.length ===
            0
          ) {
            fromFeed += 1;
            fromFeedFallback += feed.length === 0 ? 1 : 0;
          }
        }
        console.log(
          `${name.padEnd(34)} item abstain ${round3(itemAbstain / rows.length).toFixed(3)}  unlabeled at read ${round3(unlabeled / rows.length).toFixed(3)}  feed label shown ${round3(fromFeed / rows.length).toFixed(3)} (Miscellaneous ${round3(fromFeedFallback / rows.length).toFixed(3)})`,
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
      const fallbackFeeds = feedRows.filter(
        (feed) =>
          selectCategories(
            feedScores.get(feed.feedId) ?? [],
            DEFAULT_FEED_SELECTION_RULE,
            MAX_CLASSIFIER_LABELS,
          ).length === 0,
      ).length;
      console.log(
        `feeds on the Miscellaneous fallback (${describeRule(DEFAULT_FEED_SELECTION_RULE)}): ${round3(fallbackFeeds / feedRows.length).toFixed(3)}`,
      );
      report(`embedding, ${describeRule(PRODUCTION_RULE)}`, PRODUCTION_RULE);
      if (CHOSEN_RULE) {
        const rule = CHOSEN_RULE;
        report(`embedding, ${describeRule(rule)}`, rule);
      }
    },
    1_200_000,
  );
});
