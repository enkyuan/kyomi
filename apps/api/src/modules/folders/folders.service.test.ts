import { describe, expect, mock, test } from "bun:test";
import { AppError } from "@shared/errors/app-error";
import { createFolder, markFolderReadStatus } from "./folders.service";

describe("folders.service", () => {
  test("createFolder trims and returns inserted folder", async () => {
    const createdAt = new Date("2026-04-01T00:00:00.000Z");
    const select = mock(() => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    }));
    const insert = mock(() => ({
      values: () => ({
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
    }));
    const fakeDb = { select, insert } as unknown as Parameters<typeof createFolder>[0];

    const result = await createFolder(fakeDb, "u1", "  Inbox ");
    expect(result.name).toBe("Inbox");
    expect(result.createdAt).toBe("2026-04-01T00:00:00.000Z");
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
