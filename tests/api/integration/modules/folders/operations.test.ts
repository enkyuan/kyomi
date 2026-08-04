import { describe, expect, mock, test } from "bun:test";
import { AppError } from "@shared/errors/app";
import {
  createFolder,
  deleteFolder,
  ensureFoldersByName,
  markFolderReadStatus,
  updateFolder,
} from "@modules/folders/operations";

describe("folders operations", () => {
  test("createFolder trims and returns inserted folder", async () => {
    const createdAt = new Date("2026-04-01T00:00:00.000Z");
    const insert = mock(() => ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: () =>
            Promise.resolve([
              {
                id: "550e8400-e29b-41d4-a716-446655440000",
                userId: "u1",
                name: "Inbox",
                isPinned: false,
                pinnedAt: null,
                createdAt,
                updatedAt: createdAt,
              },
            ]),
        }),
      }),
    }));
    const fakeDb = { insert } as unknown as Parameters<typeof createFolder>[0];

    const result = await createFolder(fakeDb, "u1", "  Inbox ");
    expect(result.name).toBe("Inbox");
    expect(result.createdAt).toBe("2026-04-01T00:00:00.000Z");
  });

  test("createFolder throws FOLDER_DUPLICATE when insert returns nothing", async () => {
    const insert = mock(() => ({
      values: () => ({
        onConflictDoNothing: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    }));
    const fakeDb = { insert } as unknown as Parameters<typeof createFolder>[0];

    await expect(createFolder(fakeDb, "u1", "Inbox")).rejects.toMatchObject({
      code: "FOLDER_DUPLICATE",
    });
  });

  test("markFolderReadStatus throws when folder missing", async () => {
    const select = mock(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }));
    const fakeDb = { select } as unknown as Parameters<typeof markFolderReadStatus>[0];

    await expect(markFolderReadStatus(fakeDb, "u1", "f1")).rejects.toBeInstanceOf(AppError);
  });

  test("updateFolder pins a folder and returns pinned metadata", async () => {
    const updatedAt = new Date("2026-07-01T12:00:00.000Z");
    let patch: Record<string, unknown> | undefined;
    const update = mock(() => ({
      set: (values: Record<string, unknown>) => {
        patch = values;
        return {
          where: () => ({
            returning: () =>
              Promise.resolve([
                {
                  id: "folder-1",
                  userId: "u1",
                  name: "Programming",
                  isPinned: true,
                  pinnedAt: updatedAt,
                  createdAt: new Date("2026-07-01T00:00:00.000Z"),
                  updatedAt,
                },
              ]),
          }),
        };
      },
    }));
    const fakeDb = { update } as unknown as Parameters<typeof updateFolder>[0];

    const result = await updateFolder(fakeDb, "u1", "folder-1", { isPinned: true });

    expect(patch?.isPinned).toBe(true);
    expect(patch?.pinnedAt).toBeInstanceOf(Date);
    expect(result.isPinned).toBe(true);
    expect(result.pinnedAt).toBe("2026-07-01T12:00:00.000Z");
  });

  test("updateFolder unpins a folder", async () => {
    let patch: Record<string, unknown> | undefined;
    const update = mock(() => ({
      set: (values: Record<string, unknown>) => {
        patch = values;
        return {
          where: () => ({
            returning: () =>
              Promise.resolve([
                {
                  id: "folder-1",
                  userId: "u1",
                  name: "Programming",
                  isPinned: false,
                  pinnedAt: null,
                  createdAt: new Date("2026-07-01T00:00:00.000Z"),
                  updatedAt: new Date("2026-07-01T12:00:00.000Z"),
                },
              ]),
          }),
        };
      },
    }));
    const fakeDb = { update } as unknown as Parameters<typeof updateFolder>[0];

    const result = await updateFolder(fakeDb, "u1", "folder-1", { isPinned: false });

    expect(patch).toMatchObject({ isPinned: false, pinnedAt: null });
    expect(result.isPinned).toBe(false);
    expect(result.pinnedAt).toBeNull();
  });

  test("updateFolder rejects empty patches", async () => {
    const update = mock();
    const fakeDb = { update } as unknown as Parameters<typeof updateFolder>[0];

    await expect(updateFolder(fakeDb, "u1", "folder-1", {})).rejects.toMatchObject({
      code: "EMPTY_UPDATE",
    });
    expect(update).not.toHaveBeenCalled();
  });

  test("updateFolder throws when folder missing", async () => {
    const update = mock(() => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([]),
        }),
      }),
    }));
    const fakeDb = { update } as unknown as Parameters<typeof updateFolder>[0];

    await expect(updateFolder(fakeDb, "u1", "missing", { isPinned: true })).rejects.toMatchObject({
      code: "FOLDER_NOT_FOUND",
    });
  });

  test("deleteFolder moves subscriptions to Unsorted before deleting the folder", async () => {
    let selectCall = 0;
    const updateSet = mock((values: Record<string, unknown>) => ({
      values,
      where: () => Promise.resolve(),
    }));
    const update = mock(() => ({ set: updateSet }));
    const deleteWhere = mock(() => Promise.resolve());
    const deleteFrom = mock(() => ({ where: deleteWhere }));
    const insertOnConflictDoNothing = mock(() => Promise.resolve());
    const insertValues = mock(() => ({ onConflictDoNothing: insertOnConflictDoNothing }));
    const insert = mock(() => ({ values: insertValues }));
    const select = mock(() => {
      selectCall += 1;
      return {
        from: () => ({
          where: () => ({
            limit: () =>
              Promise.resolve(
                selectCall === 1
                  ? [{ id: "folder-1", name: "Reading" }]
                  : [
                      {
                        id: "folder-unsorted",
                        userId: "u1",
                        name: "Unsorted",
                        isPinned: false,
                        pinnedAt: null,
                        createdAt: new Date("2026-07-01T00:00:00.000Z"),
                        updatedAt: new Date("2026-07-01T00:00:00.000Z"),
                      },
                    ],
              ),
          }),
        }),
      };
    });
    const fakeDb = { delete: deleteFrom, insert, select, update } as unknown as Parameters<
      typeof deleteFolder
    >[0];

    await deleteFolder(fakeDb, "u1", "folder-1");

    expect(updateSet.mock.calls[0]?.[0]).toMatchObject({ folderId: "folder-unsorted" });
    expect(updateSet.mock.calls[0]?.[0].updatedAt).toBeInstanceOf(Date);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
  });

  test("deleteFolder rejects deleting Unsorted", async () => {
    const update = mock(() => ({ set: mock() }));
    const deleteFrom = mock(() => ({ where: mock() }));
    const select = mock(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: "folder-unsorted", name: "Unsorted" }]),
        }),
      }),
    }));
    const fakeDb = { delete: deleteFrom, select, update } as unknown as Parameters<
      typeof deleteFolder
    >[0];

    await expect(deleteFolder(fakeDb, "u1", "folder-unsorted")).rejects.toMatchObject({
      code: "DEFAULT_FOLDER_DELETE_FORBIDDEN",
    });
    expect(update).not.toHaveBeenCalled();
    expect(deleteFrom).not.toHaveBeenCalled();
  });

  test("ensureFoldersByName trims, dedupes, and maps every requested name", async () => {
    const insertValues = mock(() => ({ onConflictDoNothing: () => Promise.resolve() }));
    const insert = mock(() => ({ values: insertValues }));
    const select = mock(() => ({
      from: () => ({
        where: () =>
          Promise.resolve([
            { id: "folder-1", name: "Tech" },
            { id: "folder-2", name: "News" },
          ]),
      }),
    }));
    const fakeDb = { insert, select } as unknown as Parameters<typeof ensureFoldersByName>[0];

    const result = await ensureFoldersByName(fakeDb, "u1", ["  Tech ", "News", "Tech"]);

    expect(result).toEqual(
      new Map([
        ["Tech", "folder-1"],
        ["News", "folder-2"],
      ]),
    );
    const insertedRows = insertValues.mock.calls[0]?.[0] as unknown[];
    expect(insertedRows).toHaveLength(2);
  });

  test("ensureFoldersByName returns an empty map without touching the database for no names", async () => {
    const insert = mock(() => {
      throw new Error("must not be called");
    });
    const fakeDb = { insert } as unknown as Parameters<typeof ensureFoldersByName>[0];

    expect(await ensureFoldersByName(fakeDb, "u1", ["", "   "])).toEqual(new Map());
  });

  test("ensureFoldersByName rejects a name over the 512-character limit", async () => {
    const insert = mock(() => {
      throw new Error("must not be called");
    });
    const fakeDb = { insert } as unknown as Parameters<typeof ensureFoldersByName>[0];

    await expect(ensureFoldersByName(fakeDb, "u1", ["x".repeat(513)])).rejects.toMatchObject({
      code: "FOLDER_NAME_TOO_LONG",
      status: 400,
    });
  });

  test("ensureFoldersByName batches insert and select statements at 500 names", async () => {
    const insertValues = mock(() => ({ onConflictDoNothing: () => Promise.resolve() }));
    const insert = mock(() => ({ values: insertValues }));
    const names = Array.from({ length: 501 }, (_, i) => `Folder ${i}`);
    const select = mock(() => ({
      from: () => ({
        where: () => Promise.resolve(names.map((name, i) => ({ id: `folder-${i}`, name }))),
      }),
    }));
    const fakeDb = { insert, select } as unknown as Parameters<typeof ensureFoldersByName>[0];

    const result = await ensureFoldersByName(fakeDb, "u1", names);

    expect(insertValues.mock.calls).toHaveLength(2);
    expect((insertValues.mock.calls[0]?.[0] as unknown[]).length).toBe(500);
    expect((insertValues.mock.calls[1]?.[0] as unknown[]).length).toBe(1);
    expect(result.size).toBe(501);
  });

  test("ensureFoldersByName throws FOLDER_CREATE_FAILED when a name never resolves to an id", async () => {
    const insertValues = mock(() => ({ onConflictDoNothing: () => Promise.resolve() }));
    const insert = mock(() => ({ values: insertValues }));
    const select = mock(() => ({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    }));
    const fakeDb = { insert, select } as unknown as Parameters<typeof ensureFoldersByName>[0];

    await expect(ensureFoldersByName(fakeDb, "u1", ["Tech"])).rejects.toMatchObject({
      code: "FOLDER_CREATE_FAILED",
      status: 500,
    });
  });
});
