import { afterEach, describe, expect, test } from "bun:test";
import { resolvePersistedFaviconHost } from "@kyomi/ingest/favicon";
import { MemoryFaviconHostStore, ORIGIN } from "./store";

/**
 * These exercise `@kyomi/ingest/favicon` itself, which stays a framework-free Promise package that
 * fetches with the global `fetch`; that is why they still replace it. The API handler's own
 * behaviour is covered with Layers in `handler.test.ts`.
 */

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return await handler(url);
  }) as typeof fetch;
  return calls;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function faviconResolutionFetch(url: string) {
  if (url === ORIGIN) {
    return new Response(
      '<html><head><link rel="icon" sizes="256x256" href="/icon-256.png"></head></html>',
      { headers: { "content-type": "text/html" } },
    );
  }
  if (url === `${ORIGIN}/icon-256.png`) {
    return new Response("png", { headers: { "content-type": "image/png" } });
  }
  return new Response(null, { status: 404 });
}

describe("favicon host resolution", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("prefers declared site icons before provider fallback results", async () => {
    const store = new MemoryFaviconHostStore();
    mockFetch(async (url) => {
      if (url === ORIGIN) {
        await delay(5);
        return new Response(
          '<html><head><link rel="icon" sizes="256x256" href="/icon-256.png"></head></html>',
          { headers: { "content-type": "text/html" } },
        );
      }
      if (url === `${ORIGIN}/icon-256.png`) {
        await delay(5);
        return new Response("png", { headers: { "content-type": "image/png" } });
      }
      if (url === `${ORIGIN}/favicon.ico`) {
        return new Response(null, { status: 404 });
      }
      if (url.startsWith("https://www.google.com/s2/favicons")) {
        return new Response("provider", { headers: { "content-type": "image/png" } });
      }
      if (url.startsWith("https://icons.duckduckgo.com/ip3/")) {
        return new Response("provider", { headers: { "content-type": "image/x-icon" } });
      }
      return new Response(null, { status: 404 });
    });

    const result = await resolvePersistedFaviconHost(store, ORIGIN);
    await delay(20);

    expect(result).toEqual({
      kind: "hit",
      origin: ORIGIN,
      hostname: new URL(ORIGIN).hostname,
      url: `${ORIGIN}/icon-256.png`,
      source: "html_link",
      contentType: null,
    });
    expect(store.rows.get(ORIGIN)?.resolvedUrl).toBe(`${ORIGIN}/icon-256.png`);
    expect(store.rows.get(ORIGIN)?.source).toBe("html_link");
  });

  test("dedupes concurrent same-origin resolutions", async () => {
    const store = new MemoryFaviconHostStore();
    const calls = mockFetch(faviconResolutionFetch);

    const [first, second] = await Promise.all([
      resolvePersistedFaviconHost(store, ORIGIN),
      resolvePersistedFaviconHost(store, ORIGIN),
    ]);

    expect(first?.kind).toBe("hit");
    expect(second?.kind).toBe("hit");
    expect(calls.filter((url) => url === ORIGIN)).toHaveLength(1);
  });
});
