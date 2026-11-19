import { describe, expect, test } from "vitest";
import { classifyAuthSessionPayload } from "@lib/auth/session";

const authenticatedPayload = {
  session: {
    id: "session-1",
    expiresAt: "2026-07-15T12:00:00.000Z",
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

const secrets = {
  token: "secret-session-token",
  ipAddress: "203.0.113.7",
  userAgent: "Mozilla/5.0 (secret agent)",
  locationLabel: "Springfield",
};

describe("classifyAuthSessionPayload", () => {
  test.each([null, { session: null, user: null }])(
    "classifies missing sessions as anonymous",
    (payload) => {
      expect(classifyAuthSessionPayload(payload)).toEqual({ status: "anonymous", session: null });
    },
  );

  test("classifies complete sessions as authenticated", () => {
    expect(
      classifyAuthSessionPayload({
        ...authenticatedPayload,
        session: { ...authenticatedPayload.session, ...secrets },
      }),
    ).toEqual({ status: "authenticated", session: authenticatedPayload });
  });

  test("never passes the token, IP address, user agent or any other extra field on", () => {
    const state = classifyAuthSessionPayload({
      session: { ...authenticatedPayload.session, ...secrets },
      user: { ...authenticatedPayload.user, image: null, internalNote: "staff only" },
    });

    const serialized = JSON.stringify(state);
    for (const secret of [...Object.values(secrets), "staff only"]) {
      expect(serialized).not.toContain(secret);
    }
    expect(state).toMatchObject({ status: "authenticated" });
  });

  test("a session without a token is not a complete session", () => {
    expect(classifyAuthSessionPayload(authenticatedPayload)).toMatchObject({
      status: "unavailable",
    });
  });

  test.each([
    {},
    { session: { ...authenticatedPayload.session, ...secrets }, user: null },
    { session: null, user: authenticatedPayload.user },
    "not-json-session-data",
  ])("treats malformed session payloads as unavailable", (payload) => {
    expect(classifyAuthSessionPayload(payload)).toMatchObject({
      status: "unavailable",
      session: null,
    });
  });
});
