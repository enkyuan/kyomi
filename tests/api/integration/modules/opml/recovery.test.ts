import { describe, expect, mock, test } from "bun:test";
import { Effect, Layer } from "effect";
import { reconcileImports } from "@app/jobs/dispatcher";
import { fakeDb, fakeQueue, recordingLogger } from "@api-tests/support/layers";

/**
 * Drives reconcileImports through the real store functions with a fake Postgres-shaped db,
 * rather than mock.module("@modules/opml/store", ...): that approach was tried and reverted
 * because mock.module's replacement is process-wide and not reliably undone by mock.restore()
 * once the suite has enough files (confirmed by reproducing the leak at ~50 files) -- it broke
 * store.test.ts's real-implementation tests intermittently depending on run composition.
 *
 * The fake models exactly the sequence reconcileImports issues: reclaimStalePrepareImports
 * (update parsing->accepted, then select accepted due for wakeup), findExpiredOpmlLeases
 * (select), listCancellingOpmlImportIds (select), cancelPendingOpmlItems (transaction+execute,
 * looped to 0), and optionally deleteOldTerminalOpmlImports (select then delete).
 */
function createFakeReconcileDb(options: {
  parsingReclaimed?: Array<{ id: string }>;
  dueForPrepare?: Array<{ id: string }>;
  expiredLeases?: Array<{ id: string; importId: string; leaseToken: string; attempts: number }>;
  cancellingImportIds?: Array<{ id: string }>;
  cancelBatches?: number[];
  retentionCandidates?: Array<{ id: string }>;
}) {
  const opts = {
    parsingReclaimed: [],
    dueForPrepare: [],
    expiredLeases: [],
    cancellingImportIds: [],
    cancelBatches: [0],
    retentionCandidates: [],
    ...options,
  };
  let selectCallCount = 0;
  let cancelBatchIndex = 0;
  const itemUpdateSets: Array<Record<string, unknown>> = [];

  const db = {
    update: () => ({
      set: (patch: Record<string, unknown>) => {
        itemUpdateSets.push(patch);
        return {
          where: () => ({
            returning: () => Promise.resolve(opts.parsingReclaimed),
          }),
        };
      },
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            selectCallCount += 1;
            if (selectCallCount === 1) {
              return Promise.resolve(opts.dueForPrepare);
            }
            if (selectCallCount === 2) {
              return Promise.resolve(opts.expiredLeases);
            }
            if (selectCallCount === 3) {
              return Promise.resolve(opts.cancellingImportIds);
            }
            return Promise.resolve(opts.retentionCandidates);
          },
        }),
      }),
    }),
    delete: () => ({
      where: () => ({
        returning: () => Promise.resolve(opts.retentionCandidates),
      }),
    }),
    transaction: async (callback: (tx: unknown) => unknown) => {
      let txUpdateCount = 0;
      const tx = {
        execute: () => {
          const count = opts.cancelBatches[cancelBatchIndex] ?? 0;
          cancelBatchIndex += 1;
          return Promise.resolve(Array.from({ length: count }, (_, i) => ({ id: `c${i}` })));
        },
        update: () => ({
          set: (patch: Record<string, unknown>) => {
            txUpdateCount += 1;
            if (txUpdateCount === 1) {
              itemUpdateSets.push(patch);
              return { where: () => ({ returning: () => Promise.resolve([{ id: "item-1" }]) }) };
            }
            return { where: () => Promise.resolve() };
          },
        }),
        select: () => ({
          from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
        }),
      };
      return callback(tx);
    },
  };

  return { db, itemUpdateSets };
}

type FakeDb = ReturnType<typeof createFakeReconcileDb>["db"];

/** Run `reconcileImports` against the fake Db and a fake Redis behind the real `JobQueue`. */
function reconcile(
  db: FakeDb,
  options: { includeRetention?: boolean; xadd?: () => Promise<string> } = {},
) {
  const logs = recordingLogger();
  const layer = Layer.mergeAll(
    fakeDb(db as never),
    fakeQueue({ xadd: options.xadd ?? mock(async () => "stream-id") }),
    logs.layer,
  );
  const stats = Effect.runPromise(
    reconcileImports(new Date(), { includeRetention: options.includeRetention }).pipe(
      Effect.provide(layer),
    ),
  );
  return { stats, logs };
}

describe("reconcileImports", () => {
  test("republishes a prepare wakeup for each accepted import due, and reclaims stale-parsing imports first", async () => {
    const { db, itemUpdateSets } = createFakeReconcileDb({
      parsingReclaimed: [{ id: "import-parsing-1" }],
      dueForPrepare: [{ id: "import-accepted-1" }, { id: "import-accepted-2" }],
    });

    const stats = await reconcile(db).stats;

    expect(stats.prepareRepublished).toBe(2);
    expect(itemUpdateSets[0]).toMatchObject({ status: "accepted" });
  });

  test("reclaims every expired lease with a durable retry/fail decision", async () => {
    const { db, itemUpdateSets } = createFakeReconcileDb({
      expiredLeases: [
        { id: "item-1", importId: "import-1", leaseToken: "lease-1", attempts: 1 },
        { id: "item-2", importId: "import-1", leaseToken: "lease-2", attempts: 5 },
      ],
    });

    const stats = await reconcile(db).stats;

    expect(stats.leasesReclaimed).toBe(2);
    // item-1 (attempt 1, retryable) goes back to pending; item-2 (attempt 5) fails permanently.
    expect(itemUpdateSets.some((patch) => patch.status === "pending")).toBe(true);
    expect(itemUpdateSets.some((patch) => patch.status === "failed")).toBe(true);
  });

  test("drains a cancelling import across multiple bounded batches", async () => {
    const { db } = createFakeReconcileDb({
      cancellingImportIds: [{ id: "import-1" }],
      cancelBatches: [500, 201, 0],
    });

    const stats = await reconcile(db).stats;

    expect(stats.cancellingProcessed).toBe(701);
  });

  test("does not delete terminal imports unless includeRetention is requested", async () => {
    const { db } = createFakeReconcileDb({
      retentionCandidates: [{ id: "import-old-1" }],
    });

    const stats = await reconcile(db, { includeRetention: false }).stats;

    expect(stats.retentionDeleted).toBe(0);
  });

  test("deletes terminal imports older than the cutoff when includeRetention is requested", async () => {
    const { db } = createFakeReconcileDb({
      retentionCandidates: [{ id: "import-old-1" }, { id: "import-old-2" }],
    });

    const stats = await reconcile(db, { includeRetention: true }).stats;

    expect(stats.retentionDeleted).toBe(2);
  });

  test("logs and continues when publishing a republished prepare wakeup fails", async () => {
    const { db } = createFakeReconcileDb({
      dueForPrepare: [{ id: "import-1" }],
    });
    const { stats: pending, logs } = reconcile(db, {
      xadd: async () => {
        throw new Error("redis unavailable");
      },
    });
    const stats = await pending;

    expect(stats.prepareRepublished).toBe(0);
    expect(logs.entries).toContainEqual(
      expect.objectContaining({
        level: "error",
        event: "opml.import.reconcile.prepare_republish_failed",
        context: expect.objectContaining({ importId: "import-1" }),
      }),
    );
  });
});
