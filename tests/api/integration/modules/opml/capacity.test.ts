import { describe, expect, test } from "bun:test";
import type { db } from "@adapters/db/client";
import { parseOpmlDocument } from "@modules/opml/parse";
import { insertOpmlImportItems, opmlImportItemId } from "@modules/opml/store";
import { subscribeKnownOpmlItems } from "@modules/opml/known-feeds";
import { buildOpml } from "./fixtures";

/**
 * Opt-in capacity gate: RUN_OPML_CAPACITY=true bun run --cwd tests test:api:integration -- modules/opml/capacity.test.ts
 * Skipped by default because the 50K parse/materialize scenario is a load test, not a unit test,
 * and its RSS/duration thresholds are only meaningful on a dedicated benchmark runner.
 */
const RUN = process.env.RUN_OPML_CAPACITY === "true";
const describeCapacity = RUN ? describe : describe.skip;

type DB = typeof db;

/**
 * Fake Postgres-shaped db for insertOpmlImportItems: records every values() batch size (so the
 * test can assert the 500-row ceiling) and stores rows keyed by id, so onConflictDoNothing-style
 * re-insertion (a simulated crash-and-resume reparse) is naturally idempotent.
 */
function createFakeInsertDb() {
  const rowsById = new Map<string, Record<string, unknown>>();
  const batchSizes: number[] = [];

  const db = {
    insert: () => ({
      values: (rows: Array<Record<string, unknown>>) => {
        batchSizes.push(rows.length);
        for (const row of rows) {
          if (!rowsById.has(row.id as string)) {
            rowsById.set(row.id as string, row);
          }
        }
        return { onConflictDoNothing: () => Promise.resolve() };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([{ total: rowsById.size }]),
      }),
    }),
  };

  return { db, rowsById, batchSizes };
}

describeCapacity("OPML capacity gates", () => {
  test("parses 50,000 representative outlines within the time and memory ceiling", () => {
    const xml = buildOpml(50_000);

    const startedAt = performance.now();
    const parsed = parseOpmlDocument(xml);
    const durationMs = performance.now() - startedAt;

    expect(parsed.feeds).toHaveLength(50_000);
    expect(durationMs).toBeLessThan(90_000);
    expect(process.memoryUsage().rss).toBeLessThan(768 * 1024 * 1024);
  });

  test("materializes 50,000 items in chunks no larger than 500 rows", async () => {
    const parsed = parseOpmlDocument(buildOpml(50_000));
    const { db: fakeDb, batchSizes } = createFakeInsertDb();

    const total = await insertOpmlImportItems(
      fakeDb as unknown as DB,
      "import-capacity-1",
      parsed.feeds,
      new Map(),
    );

    expect(total).toBe(50_000);
    expect(batchSizes).toEqual([...Array(99).fill(500), 500]);
    expect(batchSizes.every((size) => size <= 500)).toBe(true);
  });

  test("rerunning materialization after a simulated crash converges without duplicating items", async () => {
    const parsed = parseOpmlDocument(buildOpml(1_000));
    const { db: fakeDb, rowsById } = createFakeInsertDb();

    const firstRun = await insertOpmlImportItems(
      fakeDb as unknown as DB,
      "import-crash-1",
      parsed.feeds,
      new Map(),
    );
    const rerun = await insertOpmlImportItems(
      fakeDb as unknown as DB,
      "import-crash-1",
      parsed.feeds,
      new Map(),
    );

    expect(firstRun).toBe(1_000);
    expect(rerun).toBe(1_000);
    expect(rowsById.size).toBe(1_000);
    // opmlImportItemId is deterministic per (importId, normalizedUrl), so the rerun's ids are
    // exactly the ids already present -- the real onConflictDoNothing keys on the same pair.
    for (const feed of parsed.feeds) {
      expect(rowsById.has(opmlImportItemId("import-crash-1", feed.normalizedUrl))).toBe(true);
    }
  });

  test("bulk-completing known feeds never inserts more than the chunk ceiling per statement", async () => {
    const feedCount = 5_000;
    const pendingRows = Array.from({ length: feedCount }, (_, i) => ({
      id: `item-${i}`,
      feedId: `feed-${i}`,
      folderId: null,
      title: null,
    }));
    const insertBatchSizes: number[] = [];
    let remainingPending = [...pendingRows];

    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => {
              const batch = remainingPending.slice(0, 500);
              remainingPending = remainingPending.slice(500);
              return Promise.resolve(batch);
            },
          }),
        }),
      }),
      transaction: async (callback: (tx: unknown) => unknown) => {
        // Every matched item is a fresh subscription (no existing feedSubscriptions rows), so
        // exactly one insert batch runs, followed by exactly one "subscribed" update whose
        // affected-row count always equals the insert's inserted-row count in this scenario.
        let lastInsertedCount = 0;
        const tx = {
          select: (shape: Record<string, unknown>) => ({
            from: () => ({
              // Only the parent-status lookup (shape { status }) calls .limit(); the
              // feedId/id-shaped selects (existingSubs, feeds, feedItems) await the where()
              // result directly, so returning a resolved promise satisfies both call shapes.
              where: () =>
                "status" in shape
                  ? { limit: () => Promise.resolve([{ status: "parsing" }]) }
                  : Promise.resolve([]),
            }),
          }),
          insert: () => ({
            values: (rows: Array<{ feedId: string }>) => {
              insertBatchSizes.push(rows.length);
              lastInsertedCount = rows.length;
              return {
                onConflictDoNothing: () => ({
                  returning: () => Promise.resolve(rows.map((row) => ({ feedId: row.feedId }))),
                }),
              };
            },
          }),
          update: () => ({
            set: () => ({
              where: () => ({
                returning: () =>
                  Promise.resolve(
                    Array.from({ length: lastInsertedCount }, (_, i) => ({ id: `updated-${i}` })),
                  ),
              }),
            }),
          }),
        };
        return callback(tx);
      },
    };

    let processed = 0;
    let iterations = 0;
    while (iterations < 20) {
      const completion = await subscribeKnownOpmlItems(
        fakeDb as unknown as DB,
        "import-known-1",
        "user-1",
      );
      processed += completion.processed;
      iterations += 1;
      if (completion.processed === 0) {
        break;
      }
    }

    expect(insertBatchSizes.every((size) => size <= 500)).toBe(true);
    expect(insertBatchSizes.length).toBeGreaterThan(0);
    expect(processed).toBeGreaterThan(0);
    expect(processed).toBeLessThanOrEqual(feedCount);
  });
});
