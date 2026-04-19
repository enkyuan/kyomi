import { beforeEach, describe, expect, test, vi } from "vitest";

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock("@lib/auth-functions", () => ({
  getSession: getSessionMock,
}));

vi.mock("@tanstack/react-router", () => ({
  redirect: ({ to }: { to: string }) => ({ __redirect: true, to }),
}));

import { requireAuth, requireGuest } from "./-guards";

describe("route guards", () => {
  beforeEach(() => {
    getSessionMock.mockReset();
  });

  test("requireGuest redirects authenticated users to inbox", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "u1" }, session: { id: "s1" } });

    await expect(requireGuest()).rejects.toMatchObject({
      __redirect: true,
      to: "/inbox",
    });
  });

  test("requireAuth redirects unauthenticated users to root", async () => {
    getSessionMock.mockResolvedValue(null);

    await expect(requireAuth()).rejects.toMatchObject({
      __redirect: true,
      to: "/",
    });
  });
});
