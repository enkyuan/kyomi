import { describe, expect, mock, test } from "bun:test";
import { getUserProfileById } from "./users.service";

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
});
