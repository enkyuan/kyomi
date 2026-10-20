// Value: protects=apiJson never turns an unlisted 5xx body into user-facing text, while allow-listed actionable 5xx codes and safe 4xx messages still reach users;
//   fails_when=the 5xx allow-list is removed or widened so server internals reach the error page or toasts, or narrowed so the OPML and feed URL messages are masked;
//   why_new=no test covers apiJson's error mapping; QA reproduced a 5xx body naming an internal host on the error page;
//   seam=none; no_claim=real API responses (fetch is stubbed with synthetic bodies).
import { afterEach, describe, expect, test, vi } from "vitest";
import { apiFailureUserMessage, apiJson } from "@lib/api";

function stubFetch(status: number, body: string) {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(body, { status, headers: { "content-type": "application/json" } }),
      ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apiJson error messages", () => {
  test.each([500, 502, 503])("hides a %i body behind the generic message", async (status) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(status, JSON.stringify({ error: "connect ECONNREFUSED 10.0.0.5:5432 internal db" }));

    await expect(apiJson("/api/v1/feeds")).rejects.toThrow(apiFailureUserMessage(status));
  });

  test.each([
    [502, "<html><body>Bad Gateway</body></html>"],
    [500, ""],
  ])("hides a non-JSON %i body behind the generic message", async (status, body) => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(status, body);

    await expect(apiJson("/api/v1/feeds")).rejects.toThrow(apiFailureUserMessage(status));
  });

  test("hides an API-shaped internal 5xx message behind the generic one", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(
      503,
      JSON.stringify({
        error: { code: "MEILI_SEARCH_FAILED", message: "Meilisearch search failed (503)" },
      }),
    );

    await expect(apiJson("/api/v1/search")).rejects.toThrow(apiFailureUserMessage(503));
  });

  test.each([
    [502, "OPML_URL_FETCH_FAILED", "Could not fetch OPML URL"],
    [504, "OPML_URL_FETCH_TIMEOUT", "Timed out fetching OPML URL"],
    [504, "FEED_FETCH_FAILED", "Could not fetch feed"],
    [500, "FEED_PARSE_FAILED", "Failed to parse feed"],
  ])(
    "keeps the actionable %i %s message about the user's own URL",
    async (status, code, message) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      stubFetch(status, JSON.stringify({ error: { code, message } }));

      await expect(apiJson("/api/v1/feeds")).rejects.toThrow(message);
    },
  );

  test("keeps a safe 4xx message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    stubFetch(409, JSON.stringify({ error: "That feed is already in your list" }));

    await expect(apiJson("/api/v1/feeds")).rejects.toThrow("That feed is already in your list");
  });
});
