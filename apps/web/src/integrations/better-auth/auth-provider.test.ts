import { describe, expect, test } from "vitest";
import { normalizeInitialSession } from "./auth-provider";

describe("AuthProvider session normalization", () => {
  test("normalizes initial session date fields to Date instances", () => {
    const normalized = normalizeInitialSession({
      session: {
        id: "sess_1",
        token: "token",
        userId: "user_1",
        expiresAt: "2027-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      user: {
        id: "user_1",
        email: "u@example.com",
        emailVerified: true,
        name: "User One",
        image: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    expect(normalized?.session.expiresAt).toBeInstanceOf(Date);
    expect(normalized?.session.createdAt).toBeInstanceOf(Date);
    expect(normalized?.user.createdAt).toBeInstanceOf(Date);
  });

  test("returns null for missing initial session shape", () => {
    expect(normalizeInitialSession(null)).toBeNull();
    expect(normalizeInitialSession({ session: null, user: null })).toBeNull();
  });
});
