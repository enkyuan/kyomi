import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { createArticleClip } from "./articles.clips";

const originalFetch = globalThis.fetch;

describe("createArticleClip", () => {
  beforeEach(() => {
    globalThis.fetch = mock(async () => ({
      ok: true,
      text: async () => "<html><body><h1>Fetched title</h1><p>Fetched body</p></body></html>",
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("falls back to server-side extraction when content is omitted", async () => {
    const returning = mock(() =>
      Promise.resolve([
        {
          id: "clip_1",
          userId: "user_1",
          url: "https://example.com/article",
          title: "Fetched title Fetched body",
          content: "Fetched title Fetched body",
          note: null,
          isRead: false,
          isSaved: true,
          createdAt: new Date("2026-04-08T10:00:00.000Z"),
          updatedAt: new Date("2026-04-08T10:00:00.000Z"),
        },
      ]),
    );
    const values = mock(() => ({ returning }));
    const insert = mock(() => ({ values }));
    const fakeDb = { insert } as unknown as Parameters<typeof createArticleClip>[0];

    const result = await createArticleClip(fakeDb, "user_1", {
      url: "https://example.com/article",
    });

    expect(result.title).toBe("Fetched title Fetched body");
    expect(result.content).toBe("Fetched title Fetched body");
  });
});
