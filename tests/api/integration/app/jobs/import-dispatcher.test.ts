import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, mock, test } from "bun:test";
import {
  IMPORT_DISPATCH_LEASE_MS,
  IMPORT_DISPATCH_MAX_IMPORTS,
  IMPORT_DISPATCH_PER_IMPORT,
  IMPORT_DISPATCH_TOTAL,
  runImportDispatcherLoop,
  runImportDispatcherTick,
} from "@app/jobs/import-dispatcher";

const itemsStorePath = join(
  import.meta.dir,
  "../../../../../apps/api/src/modules/opml/store/items.ts",
);

/**
 * Drives the dispatcher through the real @modules/opml/store functions with a fake
 * Postgres-shaped db and a fake redis client, rather than mock.module(...): a module-level mock
 * of @modules/opml/store or @adapters/queue/publish-job is process-wide and was proven to leak
 * into other files' real-implementation tests at scale (store.test.ts, recovery.test.ts), even
 * with mock.restore() called afterEach -- so this file never mocks either module.
 */
function fakeRedis() {
  return { xadd: mock(async () => "stream-id") };
}

function logger() {
  return { info: mock(() => undefined), error: mock(() => undefined) };
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

describe("runImportDispatcherTick", () => {
  test("publishes exactly one ID-only wakeup per claimed item and marks imports running once", async () => {
    const { db } = createFakeDispatchDb({
      claimedRows: [
        claimedRow({ id: "item-1", import_id: "import-a", lease_token: "lease-1" }),
        claimedRow({ id: "item-2", import_id: "import-a", lease_token: "lease-2" }),
        claimedRow({ id: "item-3", import_id: "import-b", lease_token: "lease-3" }),
      ],
    });
    const redis = fakeRedis();
    const testLogger = logger();
    const now = new Date("2026-01-01T00:00:00.000Z");

    const stats = await runImportDispatcherTick(db as never, redis as never, testLogger, now);

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
    const redis = { xadd: mock(async () => Promise.reject(new Error("redis unavailable"))) };
    const testLogger = logger();

    const stats = await runImportDispatcherTick(
      db as never,
      redis as never,
      testLogger,
      new Date(),
    );

    expect(stats.published).toBe(0);
    expect(stats.releasedAfterPublishFailure).toBe(1);
    expect(updateSets.some((patch) => patch.status === "pending")).toBe(true);
    expect(testLogger.error).toHaveBeenCalledWith(
      "opml.import.dispatch.publish_failed",
      expect.objectContaining({ importId: "import-1", itemId: "item-1" }),
    );
  });

  test("does not attempt to release a lease that a concurrent claim already reused", async () => {
    const { db } = createFakeDispatchDb({
      claimedRows: [claimedRow({ id: "item-1", lease_token: "lease-1" })],
      releaseSucceeds: false,
    });
    const redis = { xadd: mock(async () => Promise.reject(new Error("redis unavailable"))) };

    const stats = await runImportDispatcherTick(db as never, redis as never, logger(), new Date());

    expect(stats.releasedAfterPublishFailure).toBe(0);
  });
});

describe("runImportDispatcherLoop", () => {
  test("ticks at least once and stops promptly once the signal aborts", async () => {
    const { db } = createFakeDispatchDb({ claimedRows: [] });
    // reconcileImports' extra store calls (reclaimStalePrepareImports, findExpiredOpmlLeases,
    // listCancellingOpmlImportIds) are select-based with no rows, so an empty select chain covers
    // all of them without a real reconciliation tick landing inside this short-lived test.
    const fullDb = {
      ...db,
      update: db.update,
      select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    };
    const redis = fakeRedis();
    const testLogger = logger();
    const controller = new AbortController();

    const loopPromise = runImportDispatcherLoop(
      fullDb as never,
      redis as never,
      testLogger,
      controller.signal,
    );
    controller.abort();
    await loopPromise;

    expect(testLogger.info).toHaveBeenCalledWith(
      "import.dispatcher.started",
      expect.objectContaining({ dispatchTickMs: 1_000, reconcileTickMs: 30_000 }),
    );
  });

  test("logs the full cause chain (not just the truncated SQL message) on tick failure", async () => {
    const rootCause = new Error("permission denied for table opml_import_items");
    rootCause.name = "DatabaseError";
    (rootCause as Record<string, unknown>).code = "42501";
    (rootCause as Record<string, unknown>).severity = "ERROR";

    const drizzleError = new Error("Failed query: WITH active_imports AS (SELECT id FROM …");
    drizzleError.name = "DrizzleQueryError";
    (drizzleError as Record<string, unknown>).cause = rootCause;

    const throwingExecuteDb = {
      execute: mock(async () => Promise.reject(drizzleError)),
    };
    const redis = fakeRedis();
    const testLogger = logger();
    const controller = new AbortController();

    const loopPromise = runImportDispatcherLoop(
      throwingExecuteDb as never,
      redis as never,
      testLogger,
      controller.signal,
    );
    controller.abort();
    await loopPromise;

    expect(testLogger.error).toHaveBeenCalledWith(
      "import.dispatcher.tick_failed",
      expect.objectContaining({
        error: expect.objectContaining({
          name: "DrizzleQueryError",
          cause: expect.objectContaining({
            name: "DatabaseError",
            message: "permission denied for table opml_import_items",
            code: "42501",
          }),
        }),
      }),
    );
  });
});
