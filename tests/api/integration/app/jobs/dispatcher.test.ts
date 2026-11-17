import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, mock, test } from "bun:test";
import { Effect, Fiber, Layer } from "effect";
import { TestClock } from "effect/testing";
import {
  IMPORT_DISPATCH_LEASE_MS,
  IMPORT_DISPATCH_MAX_IMPORTS,
  IMPORT_DISPATCH_PER_IMPORT,
  IMPORT_DISPATCH_TOTAL,
  importDispatcherLoop,
  runImportDispatcherTick,
} from "@app/jobs/dispatcher";
import { fakeDb, fakeQueue, recordingLogger } from "@api-tests/support/layers";

const itemsStorePath = join(
  import.meta.dir,
  "../../../../../apps/api/src/modules/opml/store/items.ts",
);

/**
 * Drives the dispatcher through the real @modules/opml/store functions with a fake Postgres-shaped
 * Db layer and a fake Redis client behind the real `JobQueue`; nothing is module-mocked.
 */
function redisClient() {
  return { xadd: mock(async () => "stream-id") };
}

describe("import dispatcher claim SQL", () => {
  test("uses row locks, skip locked, bounded per-import fairness, and distinct lease tokens", () => {
    const source = readFileSync(itemsStorePath, "utf8");

    expect(source).toContain("FOR UPDATE SKIP LOCKED");
    expect(source).toContain("status IN ('dispatching', 'running')");
    expect(source).toContain("CROSS JOIN LATERAL");
    expect(source).toContain("status = 'pending'");
    expect(source).toContain("gen_random_uuid()::text");
    expect(source).toContain("status = 'leased'");
    expect(source).toContain("ORDER BY import_id, position, id");
  });
});

describe("dispatcher fairness defaults", () => {
  test("defaults match the plan exactly", () => {
    expect(IMPORT_DISPATCH_MAX_IMPORTS).toBe(10);
    expect(IMPORT_DISPATCH_PER_IMPORT).toBe(5);
    expect(IMPORT_DISPATCH_TOTAL).toBe(50);
    expect(IMPORT_DISPATCH_LEASE_MS).toBe(120_000);
  });
});

function claimedRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "item-1",
    import_id: "import-1",
    position: 0,
    original_url: "https://example.com/feed.xml",
    normalized_url: "https://example.com/feed.xml",
    title: null,
    folder_name: "Unsorted",
    folder_id: null,
    feed_id: null,
    lease_token: "lease-1",
    attempts: 1,
    ...overrides,
  };
}

/** Models claimDispatchableOpmlItems' single raw execute call and the plain update chains used by markOpmlImportRunning/releaseOpmlItemLease. */
function createFakeDispatchDb(options: {
  claimedRows?: Array<Record<string, unknown>>;
  releaseSucceeds?: boolean;
}) {
  const opts = { claimedRows: [], releaseSucceeds: true, ...options };
  const updateSets: Array<Record<string, unknown>> = [];
  const db = {
    execute: () =>
      Promise.resolve(
        opts.claimedRows.map((row) => ({
          id: row.id,
          importId: row.import_id,
          position: row.position,
          originalUrl: row.original_url,
          normalizedUrl: row.normalized_url,
          title: row.title,
          folderName: row.folder_name,
          folderId: row.folder_id,
          feedId: row.feed_id,
          leaseToken: row.lease_token,
          attempts: row.attempts,
        })),
      ),
    update: () => ({
      set: (patch: Record<string, unknown>) => {
        updateSets.push(patch);
        return {
          where: () =>
            patch.status === "pending"
              ? { returning: () => Promise.resolve(opts.releaseSucceeds ? [{ id: "item-1" }] : []) }
              : Promise.resolve(),
        };
      },
    }),
  };
  return { db, updateSets };
}

function dispatchLayer(
  db: ReturnType<typeof createFakeDispatchDb>["db"] | Record<string, unknown>,
  xadd: ReturnType<typeof mock>,
) {
  const logs = recordingLogger();
  return { logs, layer: Layer.mergeAll(fakeDb(db as never), fakeQueue({ xadd }), logs.layer) };
}

describe("runImportDispatcherTick", () => {
  test("publishes exactly one ID-only wakeup per claimed item and marks imports running once", async () => {
    const { db } = createFakeDispatchDb({
      claimedRows: [
        claimedRow({ id: "item-1", import_id: "import-a", lease_token: "lease-1" }),
        claimedRow({ id: "item-2", import_id: "import-a", lease_token: "lease-2" }),
        claimedRow({ id: "item-3", import_id: "import-b", lease_token: "lease-3" }),
      ],
    });
    const redis = redisClient();
    const { layer } = dispatchLayer(db, redis.xadd);

    const stats = await Effect.runPromise(
      runImportDispatcherTick(new Date("2026-01-01T00:00:00.000Z")).pipe(Effect.provide(layer)),
    );

    expect(stats).toEqual({
      claimed: 3,
      published: 3,
      releasedAfterPublishFailure: 0,
      importsStarted: 2,
    });
    expect(redis.xadd).toHaveBeenCalledTimes(3);
  });

  test("returns a matching lease to pending on publish failure without failing the tick", async () => {
    const { db, updateSets } = createFakeDispatchDb({
      claimedRows: [claimedRow({ id: "item-1", lease_token: "lease-1" })],
    });
    const xadd = mock(async () => Promise.reject(new Error("redis unavailable")));
    const { layer, logs } = dispatchLayer(db, xadd);

    const stats = await Effect.runPromise(
      runImportDispatcherTick(new Date()).pipe(Effect.provide(layer)),
    );

    expect(stats.published).toBe(0);
    expect(stats.releasedAfterPublishFailure).toBe(1);
    expect(updateSets.some((patch) => patch.status === "pending")).toBe(true);
    expect(logs.entries).toContainEqual(
      expect.objectContaining({
        level: "error",
        event: "opml.import.dispatch.publish_failed",
        context: expect.objectContaining({ importId: "import-1", itemId: "item-1" }),
      }),
    );
  });

  test("does not attempt to release a lease that a concurrent claim already reused", async () => {
    const { db } = createFakeDispatchDb({
      claimedRows: [claimedRow({ id: "item-1", lease_token: "lease-1" })],
      releaseSucceeds: false,
    });
    const xadd = mock(async () => Promise.reject(new Error("redis unavailable")));
    const { layer } = dispatchLayer(db, xadd);

    const stats = await Effect.runPromise(
      runImportDispatcherTick(new Date()).pipe(Effect.provide(layer)),
    );

    expect(stats.releasedAfterPublishFailure).toBe(0);
  });
});

describe("importDispatcherLoop", () => {
  test("ticks at once and stops promptly when interrupted", async () => {
    const { db } = createFakeDispatchDb({ claimedRows: [] });
    // reconcileImports' extra store calls are select-based with no rows, so an empty select chain
    // covers all of them.
    const fullDb = {
      ...db,
      select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    };
    const { layer, logs } = dispatchLayer(fullDb, redisClient().xadd);

    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(importDispatcherLoop);
        yield* TestClock.adjust("3 seconds");
        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(Layer.mergeAll(layer, TestClock.layer()))),
    );

    expect(logs.entries).toContainEqual(
      expect.objectContaining({
        event: "import.dispatcher.started",
        context: expect.objectContaining({ dispatchTickMs: 1_000, reconcileTickMs: 30_000 }),
      }),
    );
  });

  test("logs the full cause chain (not just the truncated SQL message) on tick failure", async () => {
    const rootCause = Object.assign(new Error("permission denied for table opml_import_items"), {
      name: "DatabaseError",
      code: "42501",
      severity: "ERROR",
    });
    const drizzleError = Object.assign(
      new Error("Failed query: WITH active_imports AS (SELECT id FROM …"),
      { name: "DrizzleQueryError", cause: rootCause },
    );

    const { layer, logs } = dispatchLayer(
      { execute: mock(async () => Promise.reject(drizzleError)) },
      redisClient().xadd,
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(importDispatcherLoop);
        yield* Effect.yieldNow;
        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(Layer.mergeAll(layer, TestClock.layer()))),
    );

    const failure = logs.entries.find((entry) => entry.event === "import.dispatcher.tick_failed");
    expect(failure?.level).toBe("error");
    expect(failure?.context).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          name: "DatabaseError",
          cause: expect.objectContaining({
            name: "DrizzleQueryError",
            cause: expect.objectContaining({
              name: "DatabaseError",
              message: "permission denied for table opml_import_items",
              code: "42501",
            }),
          }),
        }),
      }),
    );
  });
});
