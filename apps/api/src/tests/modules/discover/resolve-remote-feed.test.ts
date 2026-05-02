import { afterEach, describe, expect, test } from "bun:test";
import { AppError } from "@shared/errors/app-error";
import { resolveRemoteFeed } from "@modules/discover/resolve-remote-feed";

describe("resolveRemoteFeed", () => {
  const originalFetch = globalThis.fetch;
  const publicFeedUrl = "https://93.184.216.34/feed.xml";

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("resolves RSS from mocked fetch", async () => {
    globalThis.fetch = (async () => {
      const body = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title><link>https://site.example/</link><description>D</description></channel></rss>`;
      const res = new Response(body, {
        status: 200,
        headers: { "content-type": "application/xml" },
      });
      Object.defineProperty(res, "url", { value: publicFeedUrl });
      return res;
    }) as unknown as typeof fetch;

    const r = await resolveRemoteFeed(publicFeedUrl);
    expect(r.canonicalUrl).toBe(publicFeedUrl);
    expect(r.title).toBe("T");
    expect(r.description).toBe("D");
  });

  test("rejects redirects into loopback space", async () => {
    globalThis.fetch = (async (input: Request | string | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === publicFeedUrl) {
        return new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/private.xml" },
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    await expect(resolveRemoteFeed(publicFeedUrl)).rejects.toMatchObject({
      code: "FEED_URL_FORBIDDEN",
    } satisfies Partial<AppError>);
  });
});
