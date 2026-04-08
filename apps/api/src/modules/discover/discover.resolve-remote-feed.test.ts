import { afterEach, describe, expect, test } from "bun:test";
import { resolveRemoteFeed } from "./discover.resolve-remote-feed";

describe("resolveRemoteFeed", () => {
  const originalFetch = globalThis.fetch;

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
      Object.defineProperty(res, "url", { value: "https://example.com/atom.xml" });
      return res;
    }) as unknown as typeof fetch;

    const r = await resolveRemoteFeed("https://example.com/atom.xml");
    expect(r.canonicalUrl).toBe("https://example.com/atom.xml");
    expect(r.title).toBe("T");
    expect(r.description).toBe("D");
  });
});
