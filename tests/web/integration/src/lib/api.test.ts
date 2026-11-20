// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { apiJson, forwardRequestToApi } from "@lib/api";
import { HttpStatusError, getErrorStatus } from "@lib/status";

beforeEach(() => {
  vi.stubEnv("API_ORIGIN", "http://api.internal:8000");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function loggedText() {
  return vi
    .mocked(console.error)
    .mock.calls.map((call) => call.map(String).join(" "))
    .join("\n");
}

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

describe("API request logging", () => {
  test("a failed auth proxy request logs its path but not the OAuth code in its query", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(
      forwardRequestToApi(
        new Request(
          "https://kyomi.test/api/auth/callback/google?code=SECRET-CODE&state=SECRET-STATE",
        ),
      ),
    ).rejects.toThrow("Unable to reach the server.");

    expect(loggedText()).toContain("GET /api/auth/callback/google -> network error");
    expect(loggedText()).not.toContain("SECRET");
  });

  test("a failed server function request logs its path but not its query", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(
      apiJson("/api/v1/articles?search=private+topic&cursor=SECRET-CURSOR"),
    ).rejects.toThrow("Unable to reach the server. Try again.");

    expect(loggedText()).toContain("GET /api/v1/articles -> network error");
    expect(loggedText()).not.toContain("SECRET");
    expect(loggedText()).not.toContain("private");
  });

  test("an API error response logs its path but not its query", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));

    await apiJson("/api/v1/discover/preview?url=https%3A%2F%2Fprivate.example").catch(
      () => undefined,
    );

    expect(loggedText()).toContain("GET /api/v1/discover/preview -> 500");
    expect(loggedText()).not.toContain("private");
  });
});
