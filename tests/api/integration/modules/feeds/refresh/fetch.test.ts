import { afterEach, describe, expect, test } from "bun:test";
import { fetchFeedDocument } from "@kyomi/worker/ingestion";

describe("fetchFeedDocument allocation safety", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("rejects an oversize response via Content-Length", async () => {
    globalThis.fetch = (async () => {
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.enqueue(new TextEncoder().encode("x"));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "content-length": String(10 * 1024 * 1024), "content-type": "application/xml" },
      });
    }) as typeof fetch;

    const result = await fetchFeedDocument("https://example.com/feed.xml");
    expect(result).toMatchObject({ ok: false, error: "Feed response too large" });
  });

  test("cancels a streamed response that crosses the byte cap without buffering it fully", async () => {
    const bigChunk = new Uint8Array(3 * 1024 * 1024).fill(97);
    let cancelled = false;
    globalThis.fetch = (async () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(bigChunk);
          controller.enqueue(bigChunk);
        },
        cancel() {
          cancelled = true;
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "content-type": "application/xml" },
      });
    }) as typeof fetch;

    const result = await fetchFeedDocument("https://example.com/feed.xml");
    expect(result).toMatchObject({ ok: false, error: "Feed response too large" });
    expect(cancelled).toBe(true);
  });

  test("still returns the decoded body for a response under the cap", async () => {
    globalThis.fetch = (async () => {
      return new Response("<rss></rss>", {
        status: 200,
        headers: { "content-type": "application/xml" },
      });
    }) as typeof fetch;

    const result = await fetchFeedDocument("https://example.com/feed.xml");
    expect(result).toMatchObject({ ok: true, body: "<rss></rss>" });
  });
});
