import { afterEach, describe, expect, test } from "bun:test";
import { fetchRemoteDocument } from "@shared/net/remote-document";

const originalFetch = globalThis.fetch;

function mockedFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): typeof globalThis.fetch {
  return (async (input: Request | string | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return handler(url, init);
  }) as typeof globalThis.fetch;
}

describe("fetchRemoteDocument", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("follows safe redirects and returns the final URL", async () => {
    globalThis.fetch = mockedFetch((url) => {
      if (url === "https://93.184.216.34/start.xml") {
        return new Response(null, { status: 302, headers: { location: "/final.xml" } });
      }
      if (url === "https://93.184.216.34/final.xml") {
        return new Response("<xml />", { status: 200, headers: { "content-type": "text/xml" } });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    await expect(fetchRemoteDocument("https://93.184.216.34/start.xml")).resolves.toMatchObject({
      ok: true,
      finalUrl: "https://93.184.216.34/final.xml",
      body: "<xml />",
      contentType: "text/xml",
    });
  });

  test("passes caller headers through without owning a feed user agent", async () => {
    let seenHeaders: HeadersInit | undefined;
    globalThis.fetch = mockedFetch((_url, init) => {
      seenHeaders = init?.headers;
      return new Response("<xml />", { status: 200 });
    });

    await expect(
      fetchRemoteDocument("https://93.184.216.34/feed.xml", {
        headers: { "user-agent": "kyomi-test-fetcher" },
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(seenHeaders).toEqual({ "user-agent": "kyomi-test-fetcher" });
  });

  test("classifies blocked URLs and oversized responses", async () => {
    await expect(fetchRemoteDocument("http://127.0.0.1/feed.xml")).resolves.toMatchObject({
      ok: false,
      code: "BLOCKED_URL",
    });

    globalThis.fetch = mockedFetch(() => new Response("x".repeat(6), { status: 200 }));
    await expect(
      fetchRemoteDocument("https://93.184.216.34/feed.xml", { maxBytes: 5 }),
    ).resolves.toMatchObject({
      ok: false,
      code: "RESPONSE_TOO_LARGE",
    });
  });
});
