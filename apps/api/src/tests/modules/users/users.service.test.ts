import { describe, expect, mock, test } from "bun:test";
import {
  getUserPreferences,
  getUserProfileById,
  updateUserEmailById,
  updateUserPreferences,
} from "@modules/users/users.service";

describe("users.service", () => {
  test("getUserProfileById returns DTO when user exists", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const updatedAt = new Date("2026-01-02T00:00:00.000Z");
    const findFirst = mock(() =>
      Promise.resolve({
        id: "user_1",
        name: "Test",
        email: "t@example.com",
        emailVerified: true,
        image: null as string | null,
        createdAt,
        updatedAt,
      }),
    );
    const fakeDb = {
      query: {
        users: { findFirst },
      },
    } as unknown as Parameters<typeof getUserProfileById>[0];

    const out = await getUserProfileById(fakeDb, "user_1");
    expect(out).toEqual({
      id: "user_1",
      name: "Test",
      email: "t@example.com",
      emailVerified: true,
      image: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(findFirst).toHaveBeenCalled();
  });

  test("getUserProfileById returns null when user missing", async () => {
    const findFirst = mock(() => Promise.resolve(undefined));
    const fakeDb = {
      query: {
        users: { findFirst },
      },
    } as unknown as Parameters<typeof getUserProfileById>[0];

    const out = await getUserProfileById(fakeDb, "missing");
    expect(out).toBeNull();
  });

  test("updateUserEmailById updates and returns normalized email", async () => {
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const updatedAt = new Date("2026-01-03T00:00:00.000Z");
    const findFirst = mock(() => Promise.resolve(undefined));
    const returning = mock(() =>
      Promise.resolve([
        {
          id: "user_1",
          name: "Test",
          email: "new@example.com",
          emailVerified: true,
          image: null as string | null,
          createdAt,
          updatedAt,
        },
      ]),
    );
    const update = mock(() => ({
      set: mock(() => ({
        where: mock(() => ({
          returning,
        })),
      })),
    }));
    const fakeDb = {
      query: {
        users: { findFirst },
      },
      update,
    } as unknown as Parameters<typeof updateUserEmailById>[0];

    const out = await updateUserEmailById(fakeDb, "user_1", "  New@Example.com ");
    expect(out).toEqual({
      id: "user_1",
      name: "Test",
      email: "new@example.com",
      emailVerified: true,
      image: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    });
    expect(findFirst).toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });

  test("updateUserEmailById rejects invalid email", async () => {
    const findFirst = mock(() => Promise.resolve(undefined));
    const update = mock(() => ({
      set: mock(() => ({
        where: mock(() => ({
          returning: mock(() => Promise.resolve([])),
        })),
      })),
    }));
    const fakeDb = {
      query: {
        users: { findFirst },
      },
      update,
    } as unknown as Parameters<typeof updateUserEmailById>[0];

    await expect(updateUserEmailById(fakeDb, "user_1", "not-an-email")).rejects.toMatchObject({
      status: 400,
      code: "USER_EMAIL_INVALID",
    });
  });

  test("updateUserEmailById rejects conflicting email", async () => {
    const findFirst = mock(() => Promise.resolve({ id: "user_2" }));
    const update = mock(() => ({
      set: mock(() => ({
        where: mock(() => ({
          returning: mock(() => Promise.resolve([])),
        })),
      })),
    }));
    const fakeDb = {
      query: {
        users: { findFirst },
      },
      update,
    } as unknown as Parameters<typeof updateUserEmailById>[0];

    await expect(updateUserEmailById(fakeDb, "user_1", "user@example.com")).rejects.toMatchObject({
      status: 409,
      code: "USER_EMAIL_CONFLICT",
    });
  });

  test("updateUserEmailById rejects missing user", async () => {
    const findFirst = mock(() => Promise.resolve(undefined));
    const update = mock(() => ({
      set: mock(() => ({
        where: mock(() => ({
          returning: mock(() => Promise.resolve([])),
        })),
      })),
    }));
    const fakeDb = {
      query: {
        users: { findFirst },
      },
      update,
    } as unknown as Parameters<typeof updateUserEmailById>[0];

    await expect(updateUserEmailById(fakeDb, "user_1", "user@example.com")).rejects.toMatchObject({
      status: 404,
      code: "USER_NOT_FOUND",
    });
  });
});

describe("users.service preferences", () => {
  function makePreferencesRow(overrides: Record<string, unknown> = {}) {
    return {
      userId: "user_1",
      readerMode: "smart",
      readerFontSizePx: 17,
      readerContentWidth: "medium",
      readerOpenLinksInNewTab: true,
      readerShowImages: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      ...overrides,
    };
  }

  function makeUpdateDb(options: {
    findFirst?: unknown;
    insertReturning?: unknown[];
    updateReturning?: unknown[];
  }) {
    const insertOnConflictDoNothing = mock(() => ({
      returning: mock(() => Promise.resolve(options.insertReturning ?? [])),
    }));
    const insertValues = mock(() => ({ onConflictDoNothing: insertOnConflictDoNothing }));
    const updateReturning = mock(() =>
      Promise.resolve(options.updateReturning ?? []),
    );
    const updateWhere = mock(() => ({ returning: updateReturning }));
    const updateSet = mock(() => ({ where: updateWhere }));
    const update = mock(() => ({ set: updateSet }));
    const insert = mock(() => ({ values: insertValues }));
    return {
      query: {
        userPreferences: {
          findFirst: mock(() => Promise.resolve(options.findFirst ?? undefined)),
        },
      },
      insert,
      update,
    } as unknown as Parameters<typeof updateUserPreferences>[0];
  }

  test("getUserPreferences returns defaults when no row exists", async () => {
    const findFirst = mock(() => Promise.resolve(undefined));
    const fakeDb = {
      query: { userPreferences: { findFirst } },
    } as unknown as Parameters<typeof getUserPreferences>[0];

    const out = await getUserPreferences(fakeDb, "user_1");
    expect(out).toEqual({
      defaultMode: "smart",
      fontSizePx: 17,
      contentWidth: "medium",
      openLinksInNewTab: true,
      showImages: true,
    });
  });

  test("getUserPreferences returns persisted preferences when row exists", async () => {
    const row = makePreferencesRow({
      readerMode: "original",
      readerFontSizePx: 20,
      readerContentWidth: "wide",
      readerOpenLinksInNewTab: false,
      readerShowImages: false,
    });
    const findFirst = mock(() => Promise.resolve(row));
    const fakeDb = {
      query: { userPreferences: { findFirst } },
    } as unknown as Parameters<typeof getUserPreferences>[0];

    const out = await getUserPreferences(fakeDb, "user_1");
    expect(out).toEqual({
      defaultMode: "original",
      fontSizePx: 20,
      contentWidth: "wide",
      openLinksInNewTab: false,
      showImages: false,
    });
  });

  test("updateUserPreferences rejects invalid defaultMode", async () => {
    const fakeDb = makeUpdateDb({});
    await expect(
      updateUserPreferences(fakeDb, "user_1", { defaultMode: "invalid" as never }),
    ).rejects.toMatchObject({ status: 400, code: "USER_PREFERENCES_INVALID_READER_MODE" });
  });

  test("updateUserPreferences rejects invalid contentWidth", async () => {
    const fakeDb = makeUpdateDb({});
    await expect(
      updateUserPreferences(fakeDb, "user_1", { contentWidth: "huge" as never }),
    ).rejects.toMatchObject({ status: 400, code: "USER_PREFERENCES_INVALID_CONTENT_WIDTH" });
  });

  test("updateUserPreferences clamps fontSizePx below minimum to 14", async () => {
    const updatedRow = makePreferencesRow({ readerFontSizePx: 14 });
    const fakeDb = makeUpdateDb({ updateReturning: [updatedRow] });

    const out = await updateUserPreferences(fakeDb, "user_1", { fontSizePx: 2 });
    expect(out.fontSizePx).toBe(14);
  });

  test("updateUserPreferences clamps fontSizePx above maximum to 22", async () => {
    const updatedRow = makePreferencesRow({ readerFontSizePx: 22 });
    const fakeDb = makeUpdateDb({ updateReturning: [updatedRow] });

    const out = await updateUserPreferences(fakeDb, "user_1", { fontSizePx: 100 });
    expect(out.fontSizePx).toBe(22);
  });

  test("updateUserPreferences accepts fontSizePx at boundary values (14 and 22)", async () => {
    const rowMin = makePreferencesRow({ readerFontSizePx: 14 });
    const fakeDbMin = makeUpdateDb({ updateReturning: [rowMin] });
    const outMin = await updateUserPreferences(fakeDbMin, "user_1", { fontSizePx: 14 });
    expect(outMin.fontSizePx).toBe(14);

    const rowMax = makePreferencesRow({ readerFontSizePx: 22 });
    const fakeDbMax = makeUpdateDb({ updateReturning: [rowMax] });
    const outMax = await updateUserPreferences(fakeDbMax, "user_1", { fontSizePx: 22 });
    expect(outMax.fontSizePx).toBe(22);
  });

  test("updateUserPreferences applies partial patch and returns updated preferences", async () => {
    const updatedRow = makePreferencesRow({ readerOpenLinksInNewTab: false });
    const fakeDb = makeUpdateDb({ updateReturning: [updatedRow] });

    const out = await updateUserPreferences(fakeDb, "user_1", { openLinksInNewTab: false });
    expect(out.openLinksInNewTab).toBe(false);
    // Other fields should remain at defaults from the seeded row
    expect(out.defaultMode).toBe("smart");
    expect(out.fontSizePx).toBe(17);
  });
});
