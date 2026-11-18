import { afterEach, describe, expect, test } from "bun:test";
import { findIconsFromHtml, resolvePersistedFaviconHost } from "@kyomi/ingest/favicon";
import { resolveHostsPublicly } from "@api-tests/support/dns";
import { MemoryFaviconHostStore, ORIGIN } from "./store";

resolveHostsPublicly();

/**
 * These exercise `@kyomi/ingest/favicon` itself, which stays a framework-free Promise package that
 * fetches with the global `fetch`; that is why they still replace it. The API handler's own
 * behaviour is covered with Layers in `handler.test.ts`.
 */

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    // A request to a name is made to the address it resolved to, with the name in `Host`; the
    // handler is written in terms of the URL the code meant to fetch.
    const requested = new URL(String(input));
    const host = new Headers(init?.headers).get("host");
    if (host) {
      requested.host = host;
    }
    const url = requested.href.replace(/^(https?:\/\/[^/]+)\/$/, "$1");
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

  test("does not follow a /favicon.ico redirect into a private network", async () => {
    const store = new MemoryFaviconHostStore();
    const calls = mockFetch((url) => {
      if (url === `${ORIGIN}/favicon.ico`) {
        return new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data/" },
        });
      }
      return new Response(null, { status: 404 });
    });

    const result = await resolvePersistedFaviconHost(store, ORIGIN);

    expect(result?.kind).toBe("miss");
    expect(calls.filter((url) => url.includes("169.254.169.254"))).toEqual([]);
  });

  test("still follows a redirect from /favicon.ico to a public host", async () => {
    const store = new MemoryFaviconHostStore();
    const calls = mockFetch((url) => {
      if (url === `${ORIGIN}/favicon.ico`) {
        return new Response(null, {
          status: 301,
          headers: { location: `${ORIGIN}/assets/fav.png` },
        });
      }
      if (url === `${ORIGIN}/assets/fav.png`) {
        return new Response("png", { headers: { "content-type": "image/png" } });
      }
      return new Response(null, { status: 404 });
    });

    const result = await resolvePersistedFaviconHost(store, ORIGIN);

    expect(result).toMatchObject({ kind: "hit", source: "favicon_ico" });
    expect(calls).toContain(`${ORIGIN}/assets/fav.png`);
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

describe("a page that declares far too many icons", () => {
  test("only the best few are fetched, then resolution moves on", async () => {
    const store = new MemoryFaviconHostStore();
    const links = Array.from(
      { length: 2_000 },
      (_, index) => `<link rel="icon" sizes="16x16" href="/i${index}.png">`,
    ).join("");
    const calls = mockFetch((url) =>
      url === ORIGIN
        ? new Response(`<html><head>${links}</head></html>`, {
            headers: { "content-type": "text/html" },
          })
        : new Response(null, { status: 404 }),
    );

    const result = await resolvePersistedFaviconHost(store, ORIGIN);

    expect(result?.kind).toBe("miss");
    expect(calls.filter((url) => /\/i\d+\.png$/.test(url)).length).toBeLessThanOrEqual(5);
  });
});

describe("icon discovery in a page", () => {
  const page = (head: string) =>
    new Response(`<html><head>${head}</head></html>`, { headers: { "content-type": "text/html" } });

  test("a page made of unterminated <link openers is scanned in linear time", async () => {
    // The scan reads at most 128 KiB; the regex this replaced took about 0.7 s on that much.
    mockFetch(() => page("<link".repeat(26_000)));

    const started = performance.now();
    const icons = await findIconsFromHtml(ORIGIN);
    const elapsed = performance.now() - started;

    expect(icons).toEqual([]);
    expect(elapsed).toBeLessThan(200);
  });

  test("icon links are still found among other markup", async () => {
    mockFetch(() =>
      page(
        '<link rel="stylesheet" href="/a.css"><link rel="icon" sizes="64x64" href="/small.png">' +
          '<LINK REL="apple-touch-icon" HREF="/touch.png"/><linkedin rel="icon" href="/no.png">',
      ),
    );

    const icons = await findIconsFromHtml(ORIGIN);

    expect(icons).toEqual([`${ORIGIN}/touch.png`, `${ORIGIN}/small.png`]);
  });
});
