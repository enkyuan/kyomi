import { describe, expect, mock, test } from "bun:test";
import { AppError } from "@shared/errors/app";
import { createFolder, deleteFolder, markFolderReadStatus } from "@modules/folders/service";

describe("folders.service", () => {
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
});
