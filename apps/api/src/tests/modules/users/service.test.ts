import { describe, expect, mock, test } from "bun:test";
import { getUserProfileById, updateUserEmailById } from "@modules/users/service";

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
