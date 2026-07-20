import { describe, expect, test } from "vitest";
import { classifyAuthSessionPayload } from "@lib/auth/session";

const authenticatedPayload = {
  session: {
    id: "session-1",
    expiresAt: "2026-07-15T12:00:00.000Z",
    token: "token",
    createdAt: "2026-07-14T12:00:00.000Z",
    updatedAt: "2026-07-14T12:00:00.000Z",
    userId: "user-1",
  },
  user: {
    id: "user-1",
    email: "reader@example.com",
    emailVerified: true,
    name: "Reader",
    createdAt: "2026-07-14T12:00:00.000Z",
    updatedAt: "2026-07-14T12:00:00.000Z",
  },
};

describe("classifyAuthSessionPayload", () => {
  test.each([null, { session: null, user: null }])(
    "classifies missing sessions as anonymous",
    (payload) => {
      expect(classifyAuthSessionPayload(payload)).toEqual({ status: "anonymous", session: null });
    },
  );

  test("classifies complete sessions as authenticated", () => {
    expect(classifyAuthSessionPayload(authenticatedPayload)).toEqual({
      status: "authenticated",
      session: authenticatedPayload,
    });
  });

  test.each([
    {},
    { session: authenticatedPayload.session, user: null },
    { session: null, user: authenticatedPayload.user },
    "not-json-session-data",
  ])("treats malformed session payloads as unavailable", (payload) => {
    expect(classifyAuthSessionPayload(payload)).toMatchObject({
      status: "unavailable",
      session: null,
    });
  });
});
