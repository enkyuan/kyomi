import { afterEach, describe, expect, test } from "bun:test";
import {
  FAVICON_PROXY_VERSION,
  resolvePersistedFaviconHost,
  type FaviconHostStore,
  type FaviconResolutionSource,
} from "@kyomi/worker/favicon";
import { handleFaviconRequestWithStore } from "@modules/favicon/handler";

type CachedFaviconHost = NonNullable<Awaited<ReturnType<FaviconHostStore["read"]>>>;

const ORIGIN = "https://93.184.216.34";

class MemoryFaviconHostStore implements FaviconHostStore {
  rows = new Map<string, CachedFaviconHost>();

  seed(row: CachedFaviconHost) {
    this.rows.set(row.origin, row);
  }

  seedHit(input: {
    origin?: string;
    resolvedUrl: string;
    source?: FaviconResolutionSource;
    expiresAt?: Date;
  }) {
    const origin = input.origin ?? ORIGIN;
    this.seed({
      origin,
      hostname: new URL(origin).hostname,
      resolvedUrl: input.resolvedUrl,
      source: input.source ?? "html_link",
      status: "hit",
      contentType: null,
      width: null,
      height: null,
      expiresAt: input.expiresAt ?? new Date(Date.now() + 60_000),
      errorCode: null,
      version: FAVICON_PROXY_VERSION,
    });
  }

  seedMiss(input: { origin?: string; expiresAt?: Date; errorCode?: string }) {
    const origin = input.origin ?? ORIGIN;
    this.seed({
      origin,
      hostname: new URL(origin).hostname,
      resolvedUrl: null,
      source: null,
      status: "miss",
      contentType: null,
      width: null,
      height: null,
      expiresAt: input.expiresAt ?? new Date(Date.now() + 60_000),
      errorCode: input.errorCode ?? "not_found",
      version: FAVICON_PROXY_VERSION,
    });
  }

  async read(origin: string) {
    return this.rows.get(origin) ?? null;
  }

  async writeHit(input: {
    origin: string;
    hostname: string;
    resolvedUrl: string;
    source: FaviconResolutionSource;
    expiresAt: Date;
  }) {
    this.seed({
      origin: input.origin,
      hostname: input.hostname,
      resolvedUrl: input.resolvedUrl,
      source: input.source,
      status: "hit",
      contentType: null,
      width: null,
      height: null,
      expiresAt: input.expiresAt,
      errorCode: null,
      version: FAVICON_PROXY_VERSION,
    });
  }

  async writeMiss(input: { origin: string; hostname: string; errorCode: string; expiresAt: Date }) {
    this.seed({
      origin: input.origin,
      hostname: input.hostname,
      resolvedUrl: null,
      source: null,
      status: "miss",
      contentType: null,
      width: null,
      height: null,
      expiresAt: input.expiresAt,
      errorCode: input.errorCode,
      version: FAVICON_PROXY_VERSION,
    });
  }

  async updateResponseMetadata(input: {
    origin: string;
    contentType: string;
    width?: number | null;
    height?: number | null;
  }) {
    const row = this.rows.get(input.origin);
    if (!row) {
      return;
    }
    this.rows.set(input.origin, {
      ...row,
      contentType: input.contentType,
      width: input.width ?? null,
      height: input.height ?? null,
    });
  }
}

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

function faviconRequest(rawDomain: string) {
  return new Request(`https://kyomi.test/api/favicon?domain=${encodeURIComponent(rawDomain)}`);
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

describe("favicon request handler", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("rejects invalid domains", async () => {
    const response = await handleFaviconRequestWithStore(
      new MemoryFaviconHostStore(),
      faviconRequest("not-a-url"),
    );

    expect(response.status).toBe(400);
  });

  test("does not fetch unsafe hosts", async () => {
    const store = new MemoryFaviconHostStore();
    const calls = mockFetch(() => new Response(null, { status: 500 }));

    const response = await handleFaviconRequestWithStore(store, faviconRequest("http://localhost"));

    expect(response.status).toBe(404);
    expect(calls).toHaveLength(0);
    expect(store.rows.get("http://localhost")?.status).toBe("miss");
  });

  test("serves a cached resolved favicon and records response metadata", async () => {
    const store = new MemoryFaviconHostStore();
    store.seedHit({ resolvedUrl: `${ORIGIN}/icon-256.png` });
    mockFetch((url) =>
      url === `${ORIGIN}/icon-256.png`
        ? new Response("png", { headers: { "content-type": "image/png" } })
        : new Response(null, { status: 404 }),
    );

    const response = await handleFaviconRequestWithStore(store, faviconRequest(ORIGIN));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(await response.text()).toBe("png");
    expect(store.rows.get(ORIGIN)?.contentType).toBe("image/png");
  });

  test("uses negative cache without remote fetch", async () => {
    const store = new MemoryFaviconHostStore();
    store.seedMiss({});
    const calls = mockFetch(() => new Response(null, { status: 500 }));

    const response = await handleFaviconRequestWithStore(store, faviconRequest(ORIGIN));

    expect(response.status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  test("refreshes a stale miss", async () => {
    const store = new MemoryFaviconHostStore();
    store.seedMiss({ expiresAt: new Date(Date.now() - 1) });
    mockFetch(faviconResolutionFetch);

    const response = await handleFaviconRequestWithStore(store, faviconRequest(ORIGIN));

    expect(response.status).toBe(200);
    expect(store.rows.get(ORIGIN)?.status).toBe("hit");
    expect(store.rows.get(ORIGIN)?.resolvedUrl).toBe(`${ORIGIN}/icon-256.png`);
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

  test("negative-caches oversized favicon responses", async () => {
    const store = new MemoryFaviconHostStore();
    store.seedHit({ resolvedUrl: `${ORIGIN}/icon-256.png` });
    mockFetch((url) =>
      url === `${ORIGIN}/icon-256.png`
        ? new Response(new Uint8Array(65 * 1024), {
            headers: { "content-type": "image/png" },
          })
        : new Response(null, { status: 404 }),
    );

    const response = await handleFaviconRequestWithStore(store, faviconRequest(ORIGIN));

    expect(response.status).toBe(404);
    expect(store.rows.get(ORIGIN)?.status).toBe("miss");
    expect(store.rows.get(ORIGIN)?.errorCode).toBe("response_too_large");
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
