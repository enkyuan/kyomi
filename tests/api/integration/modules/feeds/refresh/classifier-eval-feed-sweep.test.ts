import { afterAll, beforeAll, describe, test } from "bun:test";
import {
  MAX_CLASSIFIER_LABELS,
  MISCELLANEOUS_CATEGORY_LABEL,
  scoreFeedEmbedding,
  scoreItemEmbeddings,
  selectCategories,
  DEFAULT_FEED_SELECTION_RULE,
  type CategoryScore,
} from "@kyomi/worker";
import { cachedEmbeddingsFetch, embeddingsCacheFile } from "./embedding-cache";
import { round3 } from "./classifier-eval-scoring";
import {
  describeRule,
  prewarmFeedTexts,
  readJsonl,
  SWEEP_ENABLED,
  sweepConfig,
  sweepUpstream,
} from "./classifier-eval-sweep-setup";

/**
 * Feed rule sweep for the category head. Opt-in (`CLASSIFIER_SWEEP=1` plus
 * CLASSIFIER_SWEEP_FEEDS) because it prints tables for a human to read instead of asserting.
 *
 * CLASSIFIER_SWEEP_FEEDS is a JSONL file (one object per line, never committed) of feeds with
 * publisher-declared categories, `{ feedId, feedTitle, feedDescription, feedUrl, feedSiteUrl,
 * labels, items }`, where `items` are the feed's recent articles (`{ id, itemTitle, itemSummary,
 * itemContentText, itemUrl }`, newest first, none from the head's training labels). Compares
 * scoring the feed text with scoring its articles, and sweeps the feed rule against those weak
 * labels.
 */

const FEED_FLOORS = Array.from({ length: 9 }, (_, i) => round3(i * 0.05));
const FEED_MARGINS = [0, 0.05, 0.1, 0.2];

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

type FeedMethod = [string, (feed: FeedRow) => CategoryScore[]];

const originalFetch = globalThis.fetch;

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

async function scoreFeeds(feeds: readonly FeedRow[]): Promise<FeedMethod[]> {
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
    textScores.set(feed.feedId, await scoreFeedEmbedding(feedInput(feed), sweepConfig));
  }
  const itemScores = await scoreItemEmbeddings(
    feeds.flatMap((feed) => feed.items.map((item) => ({ ...feedInput(feed), ...item }))),
    sweepConfig,
  );
  const articleMean = (feed: FeedRow, count: number) =>
    meanScores(
      feed.items
        .slice(0, count)
        .flatMap((item) => (itemScores.has(item.id) ? [itemScores.get(item.id)!] : [])),
    );
  return [
    ["A: feed text", (feed) => textScores.get(feed.feedId)!],
    ...[5, 20].map(
      (count): FeedMethod => [
        `B: mean of ${count} recent articles`,
        (feed) => articleMean(feed, count),
      ],
    ),
    [
      "A+B: mean of A and B@20",
      (feed) => meanScores([textScores.get(feed.feedId)!, articleMean(feed, 20)]),
    ],
  ];
}

function reportMethods(feeds: readonly FeedRow[], methods: readonly FeedMethod[]): void {
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
}

/** The production rule: below the floor a feed falls back to Miscellaneous. */
function reportRules(feeds: readonly FeedRow[], score: FeedMethod[1]): void {
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
      const selected = selectCategories(score(feed), rule, MAX_CLASSIFIER_LABELS).map(
        (entry) => entry.label,
      );
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
}

beforeAll(() => {
  globalThis.fetch = cachedEmbeddingsFetch({
    cacheFile: embeddingsCacheFile("feeds"),
    upstream: sweepUpstream,
    realFetch: originalFetch,
  });
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe.skipIf(!SWEEP_ENABLED || !process.env.CLASSIFIER_SWEEP_FEEDS)(
  "embedding classifier feed rule sweep (BGE-M3)",
  () => {
    test("compares feed scoring and sweeps the feed rule against publisher-declared categories", async () => {
      const feeds = readJsonl<FeedRow>(process.env.CLASSIFIER_SWEEP_FEEDS!);
      const methods = await scoreFeeds(feeds);
      reportMethods(feeds, methods);
      reportRules(feeds, methods[0]![1]);
    }, 1_200_000);
  },
);
