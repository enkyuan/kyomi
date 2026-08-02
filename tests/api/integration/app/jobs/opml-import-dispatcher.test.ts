import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, mock, test } from "bun:test";
import {
  OPML_DISPATCH_LEASE_MS,
  OPML_DISPATCH_MAX_IMPORTS,
  OPML_DISPATCH_PER_IMPORT,
  OPML_DISPATCH_TOTAL,
  runOpmlImportDispatcherTick,
} from "@app/jobs/opml-import-dispatcher";

const itemsStorePath = join(
  import.meta.dir,
  "../../../../../apps/api/src/modules/opml/store/items.ts",
);

describe("opml import dispatcher claim SQL", () => {
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
    expect(OPML_DISPATCH_MAX_IMPORTS).toBe(10);
    expect(OPML_DISPATCH_PER_IMPORT).toBe(5);
    expect(OPML_DISPATCH_TOTAL).toBe(50);
    expect(OPML_DISPATCH_LEASE_MS).toBe(120_000);
  });
});

function claimedItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "item-1",
    importId: "import-1",
    position: 0,
    originalUrl: "https://example.com/feed.xml",
    normalizedUrl: "https://example.com/feed.xml",
    title: null,
    folderName: "Unsorted",
    folderId: null,
    feedId: null,
    leaseToken: "lease-1",
    attempts: 1,
    ...overrides,
  };
}

describe("runOpmlImportDispatcherTick", () => {
  test("publishes exactly one ID-only wakeup per claimed item and marks imports running once", async () => {
    const claimed = [
      claimedItem({ id: "item-1", importId: "import-a", leaseToken: "lease-1" }),
      claimedItem({ id: "item-2", importId: "import-a", leaseToken: "lease-2" }),
      claimedItem({ id: "item-3", importId: "import-b", leaseToken: "lease-3" }),
    ];
    const claimDispatchableOpmlItemsMock = mock(async () => claimed);
    const markOpmlImportRunningMock = mock(async () => undefined);
    const releaseOpmlItemLeaseMock = mock(async () => true);
    const publishJobMock = mock(async () => "stream-id");
    mock.module("@modules/opml/store", () => ({
      claimDispatchableOpmlItems: claimDispatchableOpmlItemsMock,
      markOpmlImportRunning: markOpmlImportRunningMock,
      releaseOpmlItemLease: releaseOpmlItemLeaseMock,
    }));
    mock.module("@adapters/queue/publish-job", () => ({
      publishJob: publishJobMock,
    }));
    const { runOpmlImportDispatcherTick: tick } = await import("@app/jobs/opml-import-dispatcher");

    const logger = { info: mock(() => undefined), error: mock(() => undefined) };
    const now = new Date("2026-01-01T00:00:00.000Z");
    const stats = await tick({} as never, {} as never, logger, now);

    expect(stats).toEqual({
      claimed: 3,
      published: 3,
      releasedAfterPublishFailure: 0,
      importsStarted: 2,
    });
    expect(claimDispatchableOpmlItemsMock).toHaveBeenCalledWith({}, now, {
      maxImports: 10,
      perImport: 5,
      total: 50,
      leaseMs: 120_000,
    });
    expect(publishJobMock).toHaveBeenCalledWith(
      {},
      {
        type: "opml.import.item",
        payload: { importId: "import-a", itemId: "item-1", leaseToken: "lease-1" },
      },
    );
    expect(markOpmlImportRunningMock).toHaveBeenCalledTimes(2);
    expect(releaseOpmlItemLeaseMock).not.toHaveBeenCalled();
  });

  test("returns a matching lease to pending on publish failure without failing the tick", async () => {
    const claimed = [claimedItem({ id: "item-1", leaseToken: "lease-1" })];
    mock.module("@modules/opml/store", () => ({
      claimDispatchableOpmlItems: mock(async () => claimed),
      markOpmlImportRunning: mock(async () => undefined),
      releaseOpmlItemLease: mock(async () => true),
    }));
    const publishJobMock = mock(async () => {
      throw new Error("redis unavailable");
    });
    mock.module("@adapters/queue/publish-job", () => ({
      publishJob: publishJobMock,
    }));
    const { runOpmlImportDispatcherTick: tick } = await import("@app/jobs/opml-import-dispatcher");

    const logger = { info: mock(() => undefined), error: mock(() => undefined) };
    const stats = await tick({} as never, {} as never, logger, new Date());

    expect(stats.published).toBe(0);
    expect(stats.releasedAfterPublishFailure).toBe(1);
    expect(logger.error).toHaveBeenCalledWith(
      "opml.import.dispatch.publish_failed",
      expect.objectContaining({ importId: "import-1", itemId: "item-1" }),
    );
  });

  test("does not attempt to release a lease that a concurrent claim already reused", async () => {
    const claimed = [claimedItem({ id: "item-1", leaseToken: "lease-1" })];
    const releaseOpmlItemLeaseMock = mock(async () => false);
    mock.module("@modules/opml/store", () => ({
      claimDispatchableOpmlItems: mock(async () => claimed),
      markOpmlImportRunning: mock(async () => undefined),
      releaseOpmlItemLease: releaseOpmlItemLeaseMock,
    }));
    mock.module("@adapters/queue/publish-job", () => ({
      publishJob: mock(async () => {
        throw new Error("redis unavailable");
      }),
    }));
    const { runOpmlImportDispatcherTick: tick } = await import("@app/jobs/opml-import-dispatcher");

    const logger = { info: mock(() => undefined), error: mock(() => undefined) };
    const stats = await tick({} as never, {} as never, logger, new Date());

    expect(stats.releasedAfterPublishFailure).toBe(0);
    expect(releaseOpmlItemLeaseMock).toHaveBeenCalledTimes(1);
  });
});
