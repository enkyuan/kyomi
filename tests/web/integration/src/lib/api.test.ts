// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiJson } from "@lib/api";
import { HttpStatusError, getErrorStatus } from "@lib/status";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("apiJson", () => {
  test("returns the parsed body of a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ ok: true })));

    await expect(apiJson("/api/v1/ping")).resolves.toEqual({ ok: true });
  });

  test.each([401, 403, 404, 429, 503])(
    "keeps the %i status on the error it throws",
    async (status) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status })));

      const error = await apiJson("/api/v1/ping").catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(HttpStatusError);
      expect(getErrorStatus(error)).toBe(status);
    },
  );

  test("still falls back to the safe message when the server's is unsafe", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(Response.json({ message: "HTTP 404 at /internal" }, { status: 404 })),
    );

    await expect(apiJson("/api/v1/ping")).rejects.toThrow("That item could not be found.");
  });

  test("throws a plain error when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const error = await apiJson("/api/v1/ping").catch((caught: unknown) => caught);

    expect(error).not.toBeInstanceOf(HttpStatusError);
    expect((error as Error).message).toBe("Unable to reach the server. Try again.");
  });
});
