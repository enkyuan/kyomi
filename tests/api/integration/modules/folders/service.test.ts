import { describe, expect, mock, test } from "bun:test";
import { AppError } from "@shared/errors/app";
import { createFolder, markFolderReadStatus } from "@modules/folders/service";

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
});
