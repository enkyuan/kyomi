import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import { parseBackfillArgs } from "@modules/catalog/backfill/cli";
import { runCategoryBackfill } from "@modules/catalog/backfill/operations";
import { UpstreamError } from "@shared/effect/errors";
import { recordingLogger, testConfig } from "@api-tests/support/layers";
import { fakeEmbeddings, recordingDb } from "../fakes";

const EMBEDDINGS_ENV = {
  CLOUDFLARE_EMBEDDINGS_URL: "https://fake-embeddings.test/embed",
  CLOUDFLARE_EMBEDDINGS_TOKEN: "test-token",
};

const feed = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title: "Airbnb Engineering",
  description: "Software engineering posts about infrastructure and architecture.",
  url: `https://medium.com/feed/${id}`,
  link: `https://medium.com/${id}`,
  sourceKind: "rss",
  ...overrides,
});

const item = (id: string, feedId: string, overrides: Record<string, unknown> = {}) => ({
  id,
  feedId,
  title: "Bitcoin market rally lifts crypto stocks",
  summary: "Investors watch market prices, stock performance, and crypto trading volume.",
  contentText: null,
  extractedContentText: null,
  link: `https://example.com/${id}`,
  canonicalUrl: `https://example.com/${id}`,
  ...overrides,
});

type Rows = { feeds?: unknown[][]; items?: unknown[]; assignments?: Record<string, unknown[]> };

/** Serves `feeds` pages in order and the same `items` to every item query. */
function database({ feeds = [], items = [], assignments = {} }: Rows = {}) {
  const pages = [...feeds];
  return recordingDb(({ table }) => {
    if (table === "feeds") {
      return pages.shift() ?? [];
    }
    if (table === "feed_items") {
      return items;
    }
    return table ? (assignments[table] ?? []) : [];
  });
}

function run(
  flags: string[],
  db: ReturnType<typeof recordingDb>,
  embeddings = fakeEmbeddings(),
  env: Record<string, string> = {},
) {
  const logger = recordingLogger();
  const program = Effect.gen(function* () {
    const args = yield* parseBackfillArgs(["bun", "backfill", ...flags]);
    return yield* runCategoryBackfill(args);
  }).pipe(
    Effect.provide(
      Layer.mergeAll(db.layer, embeddings, logger.layer, testConfig(env), TestClock.layer()),
    ),
  );
  return {
    logger,
    /** Runs the backfill; rejects if it fails. */
    result: () => Effect.runPromise(program),
    /** Runs the backfill and reports its exit instead of rejecting. */
    exit: () => Effect.runPromiseExit(program),
  };
}

describe("runCategoryBackfill", () => {
  test("a dry run counts what it would classify and writes nothing", async () => {
    const db = database({
      feeds: [[feed("feed-1")]],
      items: [
        item("item-1", "feed-1"),
        item("item-2", "feed-1", { title: "Weekly notes", summary: null }),
      ],
    });

    const stats = await run([], db).result();

    expect(stats).toMatchObject({
      apply: false,
      classifierMethod: "keyword",
      feedsScanned: 1,
      feedsWithClassifierCategories: 1,
      itemsScanned: 2,
      itemsWithClassifierCategories: 1,
      itemClassifierAbstentions: 1,
      feedsFailed: 0,
      feedBackfillStatusesRecorded: 0,
    });
    expect(db.calls.filter((call) => call.op !== "select")).toEqual([]);
  });

  test("apply replaces the classifier rows page by page, then the feed's once", async () => {
    const db = database({
      feeds: [[feed("feed-1")]],
      items: [item("item-1", "feed-1")],
    });

    await run(["--apply"], db).result();

    expect(db.inserted("feed_item_category_assignments")).toMatchObject([
      { feedItemId: "item-1", provenance: "classifier", modelId: expect.any(String) },
    ]);
    expect(db.inserted("feed_category_assignments")).toMatchObject([
      { feedId: "feed-1", provenance: "classifier" },
    ]);
    // A capped run says nothing about coverage, so no coverage rows are written.
    expect(db.inserted("feed_category_backfill_status")).toEqual([]);
  });

  test("a feed failing under the embedding classifier ends the run unless --all", async () => {
    const db = database({ feeds: [[feed("feed-1")]], items: [item("item-1", "feed-1")] });

    const { exit, logger } = run(
      ["--classifier", "embedding"],
      db,
      fakeEmbeddings(),
      EMBEDDINGS_ENV,
    );

    const outcome = await exit();
    expect(outcome._tag).toBe("Failure");
    expect(JSON.stringify(outcome)).toContain("UpstreamError");
    expect(logger.entries.map((entry) => entry.event)).toContain(
      "catalog.backfill.feed_embedding_failed",
    );
  });

  test("--all records a failing feed as failed with the cause text and keeps going", async () => {
    const db = database({
      feeds: [[feed("feed-1"), feed("feed-2")]],
      items: [],
    });
    const embeddings = fakeEmbeddings({
      classifyFeed: (input) =>
        input.feedUrl.endsWith("feed-2")
          ? Effect.fail(
              new UpstreamError({
                operation: "embeddings.classifyFeed",
                cause: new Error("embeddings unavailable"),
              }),
            )
          : Effect.succeed({ categories: [{ label: "Software Engineering", confidence: 0.9 }] }),
    });

    const stats = await run(
      ["--all", "--apply", "--classifier", "embedding"],
      db,
      embeddings,
      EMBEDDINGS_ENV,
    ).result();

    expect(stats).toMatchObject({
      feedsScanned: 2,
      feedsFailed: 1,
      feedsWithClassifierCategories: 1,
      feedBackfillStatusesRecorded: 2,
    });
    const statuses = db.inserted("feed_category_backfill_status");
    expect(statuses).toMatchObject([
      { feedId: "feed-1", status: "processed", lastError: null },
      { feedId: "feed-2", status: "failed" },
    ]);
    // Only the feed that classified is written.
    expect(db.inserted("feed_category_assignments")).toMatchObject([{ feedId: "feed-1" }]);
  });

  test("--all --feed-id works one feed at a time and records a failure without stopping", async () => {
    const db = database({ feeds: [[feed("feed-1")]], items: [item("item-1", "feed-1")] });

    const stats = await run(
      ["--all", "--feed-id", "feed-1", "--apply", "--classifier", "embedding"],
      db,
      fakeEmbeddings(),
      EMBEDDINGS_ENV,
    ).result();

    expect(stats).toMatchObject({
      feedsScanned: 1,
      feedsFailed: 1,
      feedBackfillStatusesRecorded: 1,
      itemEmbeddingFailures: 1,
    });
    expect(db.inserted("feed_category_backfill_status")).toMatchObject([
      { feedId: "feed-1", status: "failed", lastError: "embeddings unavailable" },
    ]);
  });

  test("the embedding classifier needs the Worker configured", async () => {
    const outcome = await run(["--classifier", "embedding"], database()).exit();

    expect(JSON.stringify(outcome)).toContain("EmbeddingsNotConfigured");
  });

  test("--normalize-existing rewrites mapped labels and drops unmapped assignments", async () => {
    const db = database({
      feeds: [[]],
      assignments: {
        feed_category_assignments: [
          {
            id: "a-1",
            subjectId: "feed-1",
            categoryId: "c-1",
            provenance: "feed",
            categoryLabel: "SaaS",
          },
          {
            id: "a-2",
            subjectId: "feed-2",
            categoryId: "c-2",
            provenance: "feed",
            categoryLabel: "Feedspot Curated List #42",
          },
          {
            id: "a-3",
            subjectId: "feed-3",
            categoryId: "c-3",
            provenance: "feed",
            categoryLabel: "AI & ML",
          },
        ],
      },
    });

    const stats = await run(["--normalize-existing", "--apply"], db).result();

    expect(stats).toMatchObject({
      normalizedExistingAssignments: true,
      assignmentsScanned: 3,
      assignmentsRewritten: 1,
      assignmentsDroppedUnmapped: 1,
    });
    expect(db.inserted("feed_category_assignments")).toMatchObject([
      { feedId: "feed-1", provenance: "feed" },
    ]);
    expect(db.inserted("categories")).toMatchObject([{ label: "Business & Startups" }]);
    // The retargeted row and the unmapped one are both deleted.
    expect(db.count("delete", "feed_category_assignments")).toBe(2);
  });

  test("--normalize-existing without --apply only counts", async () => {
    const db = database({
      feeds: [[]],
      assignments: {
        feed_category_assignments: [
          {
            id: "a-1",
            subjectId: "feed-1",
            categoryId: "c-1",
            provenance: "feed",
            categoryLabel: "SaaS",
          },
        ],
      },
    });

    const stats = await run(["--normalize-existing"], db).result();

    expect(stats).toMatchObject({ assignmentsScanned: 1, assignmentsRewritten: 1 });
    expect(db.calls.filter((call) => call.op !== "select")).toEqual([]);
  });
});
