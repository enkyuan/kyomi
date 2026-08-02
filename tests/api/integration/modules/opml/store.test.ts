import { describe, expect, mock, test } from "bun:test";
import { AppError } from "@shared/errors/app";
import {
  buildOpmlImportSummary,
  createOpmlImport,
  deleteTerminalOpmlImport,
  getOpmlImportForUser,
  insertOpmlImportItems,
  listActiveOpmlImportsForUser,
  opmlImportItemId,
  opmlImportStatusMessage,
  requestOpmlImportCancellation,
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
