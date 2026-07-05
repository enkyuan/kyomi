import { afterEach, describe, expect, test } from "bun:test";
import { AppError } from "@shared/errors/app";
import { discoverFeedUrlFromHtml } from "@kyomi/worker/ingestion";
import { resolveRemoteFeed } from "@modules/discover/feed/resolve/remote";

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

  test("falls back to http when https certificate verification fails", async () => {
    const httpsUrl = "https://93.184.216.34/feed.xml";
    const httpUrl = "http://93.184.216.34/feed.xml";

    globalThis.fetch = (async (input: Request | string | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === httpsUrl) {
        throw new Error("unable to verify the first certificate");
      }
      if (url === httpUrl) {
        return new Response(
          `<?xml version="1.0"?><rss version="2.0"><channel><title>HTTP Feed</title><link>http://93.184.216.34/</link><description>Fallback path</description></channel></rss>`,
          {
            status: 200,
            headers: { "content-type": "application/rss+xml" },
          },
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const result = await resolveRemoteFeed(httpsUrl);

    expect(result).toMatchObject({
      canonicalUrl: httpUrl,
      canonicalFeedUrl: httpUrl,
      submittedUrl: httpsUrl,
      discoveredFromUrl: httpsUrl,
      discoveryProvenance: "http_fallback",
      title: "HTTP Feed",
      description: "Fallback path",
      link: "http://93.184.216.34/",
      iconUrl: null,
    });
  });

  test("autodiscovers feed URL from HTML alternate links", async () => {
    const siteUrl = "https://93.184.216.34/";
    const feedUrl = "https://93.184.216.34/feed.xml";

    globalThis.fetch = (async (input: Request | string | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === siteUrl) {
        return new Response(
          `<!doctype html><html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head><body></body></html>`,
          {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          },
        );
      }
      if (url === feedUrl) {
        return new Response(
          `<?xml version="1.0"?><rss version="2.0"><channel><title>Example Feed</title><link>${siteUrl}</link><description>Latest updates</description></channel></rss>`,
          {
            status: 200,
            headers: { "content-type": "application/rss+xml" },
          },
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as unknown as typeof fetch;

    const result = await resolveRemoteFeed(siteUrl);

    expect(result).toMatchObject({
      canonicalUrl: feedUrl,
      canonicalFeedUrl: feedUrl,
      submittedUrl: siteUrl,
      siteUrl,
      discoveredFromUrl: siteUrl,
      discoveryProvenance: "html_autodiscovery",
      title: "Example Feed",
      description: "Latest updates",
      link: siteUrl,
      iconUrl: null,
    });
  });

  test("ranks alternate feed links by supported feed type", () => {
    const html = `<!doctype html><html><head>
      <link rel="alternate" type="application/json" href="/feed.json">
      <link rel="alternate" type="application/atom+xml" href="/atom.xml">
      <link rel="alternate" type="application/rss+xml" href="/rss.xml">
    </head></html>`;

    expect(discoverFeedUrlFromHtml(html, "https://93.184.216.34/posts/")).toBe(
      "https://93.184.216.34/rss.xml",
    );
  });
});
