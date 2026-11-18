import { afterEach, describe, expect, test } from "bun:test";
import { fetchFeedDocument } from "@kyomi/ingest/ingestion";

/**
 * The feed worker fetches whatever URL a user subscribed to. A destination inside the network must
 * be refused before any request is made, whether the URL says so directly, a public-looking name
 * resolves there, or a redirect leads there.
 */

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

type Seen = { url: string; host: string | null };

function stubNetwork(respond: (seen: Seen) => Response = () => new Response("<rss></rss>")) {
  const requests: Seen[] = [];
  globalThis.fetch = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const seen = { url: String(input), host: new Headers(init?.headers).get("host") };
    requests.push(seen);
    return respond(seen);
  }) as unknown as typeof fetch;
  return requests;
}

const PUBLIC = ["93.184.216.34"];
const resolvePublic = async () => PUBLIC;

describe("fetchFeedDocument destination policy", () => {
  test.each([
    "http://localhost:9/feed.xml",
    "http://localhost.:9/feed.xml",
    "http://foo.localhost:9/feed.xml",
    "http://127.0.0.1:9/feed.xml",
    "http://redis:6379/",
    "http://postgres:5432/",
    "http://metadata.google.internal/",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.100.100.200/",
    "http://100.64.0.1/",
    "http://0.1.2.3/",
    "http://[::1]:9/",
    "http://[fd00:ec2::254]/",
    "http://[fe90::1]/",
    "ftp://example.com/feed.xml",
  ])("refuses %s before any request", async (url) => {
    const requests = stubNetwork();

    const result = await fetchFeedDocument(url, null, null, { resolve: resolvePublic });

    expect(result).toMatchObject({ ok: false });
    expect(requests).toEqual([]);
  });

  test("refuses a public-looking name that resolves into the network", async () => {
    const requests = stubNetwork();

    const result = await fetchFeedDocument("https://feeds.example.com/rss", null, null, {
      resolve: async () => ["93.184.216.34", "10.0.0.8"],
    });

    expect(result).toMatchObject({ ok: false, error: "Private network URLs are not allowed" });
    expect(requests).toEqual([]);
  });

  test.each([
    "http://127.0.0.1:9/",
    "http://redis:6379/",
    "http://[fd00:ec2::254]/",
    "http://169.254.169.254/latest/",
  ])("stops a redirect to %s before it is requested", async (target) => {
    const requests = stubNetwork(
      () => new Response(null, { status: 302, headers: { location: target } }),
    );

    const result = await fetchFeedDocument("https://feeds.example.com/rss", null, null, {
      resolve: resolvePublic,
    });

    expect(result).toMatchObject({ ok: false });
    expect(requests).toHaveLength(1);
  });

  test("connects to the address it checked, with the name as Host, and follows a public redirect", async () => {
    let lookups = 0;
    const requests = stubNetwork(({ url }) =>
      url.includes("/old")
        ? new Response(null, { status: 301, headers: { location: "https://cdn.example.net/new" } })
        : new Response("<rss></rss>", { headers: { "content-type": "application/xml" } }),
    );

    const result = await fetchFeedDocument("https://feeds.example.com/old", null, null, {
      resolve: async () => {
        lookups += 1;
        return PUBLIC;
      },
    });

    expect(result).toMatchObject({ ok: true, finalUrl: "https://cdn.example.net/new" });
    expect(requests).toEqual([
      { url: "https://93.184.216.34/old", host: "feeds.example.com" },
      { url: "https://93.184.216.34/new", host: "cdn.example.net" },
    ]);
    expect(lookups).toBe(2);
  });
});
