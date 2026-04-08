import { describe, expect, test } from "bun:test";

import { requireAuth } from "./auth.middleware";

describe("requireAuth", () => {
  test("returns the Better Auth user id from the resolved session", async () => {
    const headers = new Headers({
      cookie: "better-auth.session_token=session-token",
    });
    const sessionResolver = {
      getSession: async ({ headers: requestHeaders }: { headers: Headers }) => {
        expect(requestHeaders).toBe(headers);
        return {
          user: { id: "user_123" },
          session: { id: "session_123" },
        };
      },
    };

    await expect(requireAuth(headers, sessionResolver)).resolves.toEqual({
      userId: "user_123",
    });
  });

  test("throws unauthorized when Better Auth returns no session", async () => {
    const sessionResolver = {
      getSession: async () => null,
    };

    await expect(requireAuth(new Headers(), sessionResolver)).rejects.toMatchObject({
      message: "Unauthorized",
      status: 401,
      code: "UNAUTHORIZED",
    });
  });
});
