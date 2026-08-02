import { describe, expect, mock, test } from "bun:test";
import { AppError } from "@shared/errors/app";
import {
  buildOpmlImportSummary,
  claimLeasedOpmlItem,
  completeOpmlItem,
  createOpmlImport,
  deleteTerminalOpmlImport,
  finalizeOpmlImportPreparation,
  getOpmlImportForUser,
  insertOpmlImportItems,
  listActiveOpmlImportsForUser,
  opmlImportItemId,
  opmlImportStatusMessage,
  recordOpmlImportMaterialized,
  requestOpmlImportCancellation,
  retryOrFailOpmlItem,
  toCompatibleOpmlImportStatus,
} from "@modules/opml/store";

function importRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "import-1",
    userId: "user-1",
    filename: "feeds.opml",
    sourceUrl: null,
    sourceXml: "<opml><body><outline/></body></opml>",
    sourceByteLength: 42,
    opmlTitle: null,
    opmlAuthor: null,
    status: "accepted",
    totalItems: 0,
    completedItems: 0,
    subscribedItems: 0,
    alreadySubscribedItems: 0,
    failedItems: 0,
    cancelledItems: 0,
    prepareWakeupAt: null,
    cancelRequestedAt: null,
    startedAt: null,
    completedAt: null,
    lastHeartbeatAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("opml import store", () => {
  test("creates one durable accepted import without parsing XML", async () => {
    const created = importRow({ userId: "user-1", status: "accepted" });
    const returning = mock(() => Promise.resolve([created]));
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const fakeDb = { insert } as unknown as Parameters<typeof createOpmlImport>[0];

    const result = await createOpmlImport(fakeDb, {
      userId: "user-1",
      filename: "feeds.opml",
      sourceXml: "<opml><body><outline/></body></opml>",
    });

    expect(result).toMatchObject({ userId: "user-1", status: "accepted" });
    expect(values).toHaveBeenCalled();
    const insertedValues = (values as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]?.[0] as Record<string, unknown>;
    expect(insertedValues.sourceByteLength).toBeGreaterThan(0);
  });

  test("rejects a source over the byte ceiling before touching the database", async () => {
    const insert = mock(() => {
      throw new Error("must not be called");
    });
    const fakeDb = { insert } as unknown as Parameters<typeof createOpmlImport>[0];

    await expect(
      createOpmlImport(fakeDb, {
        userId: "user-1",
        filename: "feeds.opml",
        sourceXml: "x".repeat(32 * 1024 * 1024 + 1),
      }),
    ).rejects.toMatchObject({ code: "OPML_TOO_LARGE", status: 413 });
    expect(insert).not.toHaveBeenCalled();
  });

  test("maps a unique-active-import constraint violation to OPML_IMPORT_ACTIVE", async () => {
    const returning = mock(() =>
      Promise.reject(
        Object.assign(new Error("duplicate key"), {
          constraint: "opml_imports_one_active_per_user_uidx",
        }),
      ),
    );
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const fakeDb = { insert } as unknown as Parameters<typeof createOpmlImport>[0];

    await expect(
      createOpmlImport(fakeDb, {
        userId: "user-1",
        filename: "feeds.opml",
        sourceXml: "<opml><body><outline/></body></opml>",
      }),
    ).rejects.toMatchObject({
      code: "OPML_IMPORT_ACTIVE",
      status: 409,
    } satisfies Partial<AppError>);
  });

  test("status reads stored counters without loading every item", async () => {
    const row = importRow({
      totalItems: 50_000,
      completedItems: 40_000,
      subscribedItems: 30_000,
      alreadySubscribedItems: 8_000,
      failedItems: 2_000,
      cancelledItems: 0,
    });
    const limit = mock(() => Promise.resolve([row]));
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    const select = mock(() => ({ from }));
    const fakeDb = { select } as unknown as Parameters<typeof getOpmlImportForUser>[0];

    const found = await getOpmlImportForUser(fakeDb, "user-1", "import-1");
    expect(found).not.toBeNull();
    expect(buildOpmlImportSummary(found as NonNullable<typeof found>)).toEqual({
      totalUrls: 50_000,
      completed: 40_000,
      subscribed: 30_000,
      alreadySubscribed: 8_000,
      failed: 2_000,
      cancelled: 0,
    });
  });

  test("returns null when the import belongs to a different user", async () => {
    const limit = mock(() => Promise.resolve([]));
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    const select = mock(() => ({ from }));
    const fakeDb = { select } as unknown as Parameters<typeof getOpmlImportForUser>[0];

    expect(await getOpmlImportForUser(fakeDb, "user-2", "import-1")).toBeNull();
  });

  test("lists at most one active import per user", async () => {
    const limit = mock(() => Promise.resolve([importRow({ status: "running" })]));
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    const select = mock(() => ({ from }));
    const fakeDb = { select } as unknown as Parameters<typeof listActiveOpmlImportsForUser>[0];

    const active = await listActiveOpmlImportsForUser(fakeDb, "user-1");
    expect(active).toHaveLength(1);
    expect(limit).toHaveBeenCalledWith(1);
  });

  test("deletes only terminal imports owned by the requesting user", async () => {
    const returning = mock(() => Promise.resolve([{ id: "import-1" }]));
    const where = mock(() => ({ returning }));
    const del = mock(() => ({ where }));
    const fakeDb = { delete: del } as unknown as Parameters<typeof deleteTerminalOpmlImport>[0];

    expect(await deleteTerminalOpmlImport(fakeDb, "user-1", "import-1")).toBe(true);
  });

  test("maps internal states to the compatible five-value status", () => {
    expect(toCompatibleOpmlImportStatus(importRow({ status: "accepted" }))).toBe("pending");
    expect(toCompatibleOpmlImportStatus(importRow({ status: "parsing" }))).toBe("in_progress");
    expect(toCompatibleOpmlImportStatus(importRow({ status: "dispatching" }))).toBe("in_progress");
    expect(toCompatibleOpmlImportStatus(importRow({ status: "running" }))).toBe("in_progress");
    expect(toCompatibleOpmlImportStatus(importRow({ status: "cancelling" }))).toBe("in_progress");
    expect(toCompatibleOpmlImportStatus(importRow({ status: "completed" }))).toBe("completed");
    expect(toCompatibleOpmlImportStatus(importRow({ status: "failed" }))).toBe("failed");
    expect(toCompatibleOpmlImportStatus(importRow({ status: "cancelled" }))).toBe("cancelled");
  });

  test("cancels an active import and reports cancelling", async () => {
    const row = importRow({ status: "running" });
    const selectLimit = mock(() => Promise.resolve([row]));
    const selectWhere = mock(() => ({ limit: selectLimit }));
    const selectFrom = mock(() => ({ where: selectWhere }));
    const select = mock(() => ({ from: selectFrom }));

    const updateReturning = mock(() => Promise.resolve([{ ...row, status: "cancelling" }]));
    const updateWhere = mock(() => ({ returning: updateReturning }));
    const updateSet = mock(() => ({ where: updateWhere }));
    const update = mock(() => ({ set: updateSet }));

    const fakeDb = { select, update } as unknown as Parameters<
      typeof requestOpmlImportCancellation
    >[0];

    const result = await requestOpmlImportCancellation(fakeDb, "user-1", "import-1");
    expect(result).toEqual({ found: true, cancelled: true, status: "in_progress" });
  });

  test("does not cancel an import that is not found", async () => {
    const limit = mock(() => Promise.resolve([]));
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    const select = mock(() => ({ from }));
    const fakeDb = { select } as unknown as Parameters<typeof requestOpmlImportCancellation>[0];

    const result = await requestOpmlImportCancellation(fakeDb, "user-1", "import-1");
    expect(result).toEqual({ found: false, cancelled: false, status: "cancelled" });
  });

  test("is idempotent for an import that is already terminal", async () => {
    const row = importRow({ status: "completed" });
    const limit = mock(() => Promise.resolve([row]));
    const where = mock(() => ({ limit }));
    const from = mock(() => ({ where }));
    const select = mock(() => ({ from }));
    const update = mock(() => {
      throw new Error("must not update a terminal import");
    });
    const fakeDb = { select, update } as unknown as Parameters<
      typeof requestOpmlImportCancellation
    >[0];

    const result = await requestOpmlImportCancellation(fakeDb, "user-1", "import-1");
    expect(result).toEqual({ found: true, cancelled: false, status: "completed" });
    expect(update).not.toHaveBeenCalled();
  });

  test("surfaces a cancellation-in-progress message while cancelling", () => {
    expect(opmlImportStatusMessage(importRow({ status: "cancelling" }))).toBe(
      "Cancellation in progress.",
    );
    expect(opmlImportStatusMessage(importRow({ status: "failed", lastErrorMessage: "boom" }))).toBe(
      "boom",
    );
    expect(opmlImportStatusMessage(importRow({ status: "accepted" }))).toBeNull();
  });

  test("opmlImportItemId is deterministic and distinguishes different imports and URLs", () => {
    const a = opmlImportItemId("import-1", "https://example.com/feed.xml");
    const b = opmlImportItemId("import-1", "https://example.com/feed.xml");
    const c = opmlImportItemId("import-1", "https://example.com/other.xml");
    const d = opmlImportItemId("import-2", "https://example.com/feed.xml");

    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
    expect(a.startsWith("import-1:")).toBe(true);
  });

  function parsedFeed(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      xmlUrl: "https://example.com/feed.xml",
      originalUrl: "https://example.com/feed.xml",
      normalizedUrl: "https://example.com/feed.xml",
      title: null,
      folderName: "Unsorted",
      ...overrides,
    } as Parameters<typeof insertOpmlImportItems>[2][number];
  }

  test("insertOpmlImportItems writes at most 500 rows per statement and returns the durable count", async () => {
    const insertCalls: unknown[][] = [];
    const insertValues = mock((rows: unknown[]) => {
      insertCalls.push(rows);
      return { onConflictDoNothing: () => Promise.resolve() };
    });
    const insert = mock(() => ({ values: insertValues }));
    const select = mock(() => ({
      from: () => ({ where: () => Promise.resolve([{ total: 1201 }]) }),
    }));
    const fakeDb = { insert, select } as unknown as Parameters<typeof insertOpmlImportItems>[0];

    const feeds = Array.from({ length: 1201 }, (_, i) =>
      parsedFeed({
        xmlUrl: `https://example.com/feed-${i}.xml`,
        originalUrl: `https://example.com/feed-${i}.xml`,
        normalizedUrl: `https://example.com/feed-${i}.xml`,
      }),
    );

    const total = await insertOpmlImportItems(fakeDb, "import-1", feeds, new Map());

    expect(insertCalls).toHaveLength(3);
    expect((insertCalls[0] as unknown[]).length).toBe(500);
    expect((insertCalls[1] as unknown[]).length).toBe(500);
    expect((insertCalls[2] as unknown[]).length).toBe(201);
    expect(total).toBe(1201);
  });

  test("insertOpmlImportItems assigns positions and resolves folderId from the folder map", async () => {
    let capturedRows: Array<Record<string, unknown>> = [];
    const insert = mock(() => ({
      values: (rows: Array<Record<string, unknown>>) => {
        capturedRows = rows;
        return { onConflictDoNothing: () => Promise.resolve() };
      },
    }));
    const select = mock(() => ({
      from: () => ({ where: () => Promise.resolve([{ total: 2 }]) }),
    }));
    const fakeDb = { insert, select } as unknown as Parameters<typeof insertOpmlImportItems>[0];

    await insertOpmlImportItems(
      fakeDb,
      "import-1",
      [
        parsedFeed({ folderName: "Tech" }),
        parsedFeed({
          xmlUrl: "https://example.com/other.xml",
          originalUrl: "https://example.com/other.xml",
          normalizedUrl: "https://example.com/other.xml",
          folderName: "Unsorted",
        }),
      ],
      new Map([["Tech", "folder-1"]]),
    );

    expect(capturedRows[0]).toMatchObject({ position: 0, folderId: "folder-1" });
    expect(capturedRows[1]).toMatchObject({ position: 1, folderId: null });
  });

  test("insertOpmlImportItems does nothing for an empty feed list", async () => {
    const insert = mock(() => {
      throw new Error("must not be called");
    });
    const fakeDb = { insert } as unknown as Parameters<typeof insertOpmlImportItems>[0];

    expect(await insertOpmlImportItems(fakeDb, "import-1", [], new Map())).toBe(0);
  });
});

describe("recordOpmlImportMaterialized", () => {
  test("records totals without leaving the parsing state", async () => {
    const where = mock(() => Promise.resolve());
    const set = mock(() => ({ where }));
    const update = mock(() => ({ set }));
    const fakeDb = { update } as unknown as Parameters<typeof recordOpmlImportMaterialized>[0];

    await recordOpmlImportMaterialized(fakeDb, "import-1", {
      totalItems: 1201,
      opmlTitle: "My Feeds",
      opmlAuthor: null,
    });

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ totalItems: 1201, opmlTitle: "My Feeds" }),
    );
    const setPatch = (set as unknown as { mock: { calls: unknown[][] } }).mock
      .calls[0]?.[0] as Record<string, unknown>;
    expect(setPatch.status).toBeUndefined();
    expect(setPatch.sourceXml).toBeUndefined();
  });
});

describe("finalizeOpmlImportPreparation", () => {
  function createFakeFinalizeDb(row: Record<string, unknown> | undefined) {
    const setCalls: Array<Record<string, unknown>> = [];
    const fakeDb = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(row ? [row] : []),
          }),
        }),
      }),
      update: () => ({
        set: (patch: Record<string, unknown>) => {
          setCalls.push(patch);
          return { where: () => Promise.resolve() };
        },
      }),
    };
    return { fakeDb, setCalls };
  }

  test("transitions to dispatching when unknown items still remain", async () => {
    const { fakeDb, setCalls } = createFakeFinalizeDb({
      totalItems: 10,
      subscribedItems: 3,
      alreadySubscribedItems: 2,
      failedItems: 0,
    });

    await finalizeOpmlImportPreparation(fakeDb as never, "import-1");

    expect(setCalls).toHaveLength(1);
    expect(setCalls[0]).toMatchObject({ status: "dispatching", sourceXml: null });
  });

  test("transitions straight to completed when every item is already terminal", async () => {
    const { fakeDb, setCalls } = createFakeFinalizeDb({
      totalItems: 10,
      subscribedItems: 7,
      alreadySubscribedItems: 3,
      failedItems: 0,
    });

    await finalizeOpmlImportPreparation(fakeDb as never, "import-1");

    expect(setCalls[0]).toMatchObject({ status: "completed", sourceXml: null });
  });

  test("transitions to failed when every item failed", async () => {
    const { fakeDb, setCalls } = createFakeFinalizeDb({
      totalItems: 5,
      subscribedItems: 0,
      alreadySubscribedItems: 0,
      failedItems: 5,
    });

    await finalizeOpmlImportPreparation(fakeDb as never, "import-1");

    expect(setCalls[0]).toMatchObject({ status: "failed", sourceXml: null });
  });

  test("does nothing when the import has already left parsing", async () => {
    const { fakeDb, setCalls } = createFakeFinalizeDb(undefined);

    await finalizeOpmlImportPreparation(fakeDb as never, "import-1");

    expect(setCalls).toHaveLength(0);
  });
});

describe("claimLeasedOpmlItem", () => {
  test("returns the claimed item with the parent's userId on a successful claim", async () => {
    const claimedRow = {
      id: "item-1",
      importId: "import-1",
      originalUrl: "https://example.com/feed.xml",
      normalizedUrl: "https://example.com/feed.xml",
      title: null,
      folderName: "Unsorted",
      folderId: null,
      feedId: null,
      leaseToken: "lease-1",
      attempts: 1,
    };
    const update = mock(() => ({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([claimedRow]) }) }),
    }));
    const select = mock(() => ({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ userId: "user-1" }]) }) }),
    }));
    const fakeDb = { update, select } as unknown as Parameters<typeof claimLeasedOpmlItem>[0];

    const claim = await claimLeasedOpmlItem(fakeDb, "import-1", "item-1", "lease-1");

    expect(claim).toMatchObject({ id: "item-1", userId: "user-1", leaseToken: "lease-1" });
  });

  test("returns null for a stale or already-claimed duplicate wakeup", async () => {
    const update = mock(() => ({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }),
    }));
    const select = mock(() => {
      throw new Error("must not look up the parent when the claim itself failed");
    });
    const fakeDb = { update, select } as unknown as Parameters<typeof claimLeasedOpmlItem>[0];

    expect(await claimLeasedOpmlItem(fakeDb, "import-1", "item-1", "lease-1")).toBeNull();
  });
});

function claimStub(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "item-1",
    importId: "import-1",
    leaseToken: "lease-1",
    attempts: 1,
    ...overrides,
  };
}

describe("completeOpmlItem", () => {
  test("increments completedItems and subscribedItems, then finalizes when everything is accounted for", async () => {
    const setCalls: Array<Record<string, unknown>> = [];
    const fakeDb = {
      transaction: async (callback: (tx: unknown) => unknown) => {
        let updateCount = 0;
        const tx = {
          update: () => ({
            set: (patch: Record<string, unknown>) => {
              updateCount += 1;
              setCalls.push(patch);
              return {
                where: () =>
                  updateCount === 1
                    ? { returning: () => Promise.resolve([{ id: "item-1" }]) }
                    : Promise.resolve(),
              };
            },
          }),
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () =>
                  Promise.resolve([
                    {
                      totalItems: 1,
                      subscribedItems: 1,
                      alreadySubscribedItems: 0,
                      failedItems: 0,
                      cancelledItems: 0,
                    },
                  ]),
              }),
            }),
          }),
        };
        return callback(tx);
      },
    };

    const result = await completeOpmlItem(fakeDb as never, claimStub(), "subscribed");

    expect(result).toBe(true);
    expect(setCalls[0]).toMatchObject({ status: "subscribed" });
    expect(setCalls[2]).toMatchObject({ status: "completed" });
  });

  test("returns false and increments nothing for a duplicate completion", async () => {
    const fakeDb = {
      transaction: async (callback: (tx: unknown) => unknown) => {
        const tx = {
          update: () => ({
            set: () => ({
              where: () => ({ returning: () => Promise.resolve([]) }),
            }),
          }),
        };
        return callback(tx);
      },
    };

    expect(await completeOpmlItem(fakeDb as never, claimStub(), "subscribed")).toBe(false);
  });
});

describe("retryOrFailOpmlItem", () => {
  test("returns a retryable failure to pending with a cleared token and delayed availableAt", async () => {
    const setCalls: Array<Record<string, unknown>> = [];
    const update = mock(() => ({
      set: (patch: Record<string, unknown>) => {
        setCalls.push(patch);
        return { where: () => Promise.resolve() };
      },
    }));
    const fakeDb = { update } as unknown as Parameters<typeof retryOrFailOpmlItem>[0];
    const availableAt = new Date("2026-01-01T00:05:00.000Z");

    await retryOrFailOpmlItem(
      fakeDb,
      claimStub({ attempts: 2 }),
      { retryable: true, code: "FEED_FETCH_FAILED", message: "timeout" },
      availableAt,
    );

    expect(setCalls).toHaveLength(1);
    expect(setCalls[0]).toMatchObject({
      status: "pending",
      leaseToken: null,
      availableAt,
    });
  });

  test("fails permanently on a non-retryable error even on the first attempt", async () => {
    const setCalls: Array<Record<string, unknown>> = [];
    const fakeDb = {
      transaction: async (callback: (tx: unknown) => unknown) => {
        let updateCount = 0;
        const tx = {
          update: () => ({
            set: (patch: Record<string, unknown>) => {
              updateCount += 1;
              setCalls.push(patch);
              return {
                where: () =>
                  updateCount === 1
                    ? { returning: () => Promise.resolve([{ id: "item-1" }]) }
                    : Promise.resolve(),
              };
            },
          }),
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () =>
                  Promise.resolve([
                    {
                      totalItems: 1,
                      subscribedItems: 0,
                      alreadySubscribedItems: 0,
                      failedItems: 1,
                      cancelledItems: 0,
                    },
                  ]),
              }),
            }),
          }),
        };
        return callback(tx);
      },
    };

    await retryOrFailOpmlItem(
      fakeDb as never,
      claimStub({ attempts: 1 }),
      { retryable: false, code: "INVALID_FEED_URL", message: "bad url" },
      new Date(),
    );

    expect(setCalls[0]).toMatchObject({ status: "failed", errorCode: "INVALID_FEED_URL" });
    expect(setCalls[2]).toMatchObject({ status: "failed" });
  });

  test("fails permanently once the max attempt count is reached, even for a retryable error", async () => {
    const setCalls: Array<Record<string, unknown>> = [];
    const fakeDb = {
      transaction: async (callback: (tx: unknown) => unknown) => {
        let updateCount = 0;
        const tx = {
          update: () => ({
            set: (patch: Record<string, unknown>) => {
              updateCount += 1;
              setCalls.push(patch);
              return {
                where: () =>
                  updateCount === 1
                    ? { returning: () => Promise.resolve([{ id: "item-1" }]) }
                    : Promise.resolve(),
              };
            },
          }),
          select: () => ({
            from: () => ({
              where: () => ({
                limit: () =>
                  Promise.resolve([
                    {
                      totalItems: 1,
                      subscribedItems: 0,
                      alreadySubscribedItems: 0,
                      failedItems: 1,
                      cancelledItems: 0,
                    },
                  ]),
              }),
            }),
          }),
        };
        return callback(tx);
      },
    };

    await retryOrFailOpmlItem(
      fakeDb as never,
      claimStub({ attempts: 5 }),
      { retryable: true, code: "FEED_FETCH_FAILED", message: "timeout" },
      new Date(),
    );

    expect(setCalls[0]).toMatchObject({ status: "failed" });
  });
});
