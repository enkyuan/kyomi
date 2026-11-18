import { describe, expect, test } from "bun:test";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { discoverFeedUrlFromHtml } from "@kyomi/ingest/ingestion";
import { resolveRemoteFeed } from "@modules/discover/feed/resolve/remote";
import { recordingLogger } from "@api-tests/support/layers";
import { scriptedHttpClient, tlsError } from "@api-tests/support/http";

const publicFeedUrl = "https://93.184.216.34/feed.xml";

const rss = (title: string, link: string, description = "D") =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>${title}</title><link>${link}</link><description>${description}</description></channel></rss>`;

const xml = (body: string) =>
  new Response(body, { status: 200, headers: { "content-type": "application/rss+xml" } });

type Answer = Parameters<typeof scriptedHttpClient>[0];

/** Resolve `url` against a scripted network, returning the result and what was logged. */
function resolveWith(respond: Answer, url = publicFeedUrl) {
  const logs = recordingLogger();
  const requested: string[] = [];
  const effect = resolveRemoteFeed(url).pipe(
    Effect.provide(
      scriptedHttpClient((request) => {
        requested.push(request.url);
        return respond(request);
      }),
    ),
    Effect.provide(logs.layer),
  );
  return { logs, requested, effect };
}

const succeeds = <A>(effect: Effect.Effect<A, unknown>) => Effect.runPromise(effect);
const failsWith = <E>(effect: Effect.Effect<unknown, E>) => Effect.runPromise(Effect.flip(effect));

describe("resolveRemoteFeed", () => {
  test("resolves RSS", async () => {
    const { effect } = resolveWith(() => xml(rss("T", "https://site.example/")));

    const result = await succeeds(effect);

    expect(result.canonicalUrl).toBe(publicFeedUrl);
    expect(result.title).toBe("T");
    expect(result.description).toBe("D");
    expect(result.discoveryProvenance).toBe("direct");
  });

  test("rejects an empty or non-http URL as invalid", async () => {
    for (const url of [
      "   ",
      "ftp://example.com/feed.xml",
      "not a url",
      // The stored feed URL is shared with, and searchable by, every account.
      "https://reader:s3cret@example.com/feed.xml",
    ]) {
      const { effect, requested } = resolveWith(() => new Error("must not be called"), url);
      expect(await failsWith(effect)).toMatchObject({
        _tag: "BadRequest",
        code: "INVALID_FEED_URL",
      });
      expect(requested).toEqual([]);
    }
  });

  test("rejects redirects into loopback space", async () => {
    const { effect } = resolveWith((request) =>
      request.url === publicFeedUrl
        ? new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private.xml" } })
        : new Error(`unexpected fetch: ${request.url}`),
    );

    expect(await failsWith(effect)).toMatchObject({
      _tag: "BadRequest",
      code: "FEED_URL_FORBIDDEN",
    });
  });

  test("falls back to http when https certificate verification fails", async () => {
    const httpUrl = "http://93.184.216.34/feed.xml";
    const { effect, logs } = resolveWith((request) => {
      if (request.url === publicFeedUrl) {
        return tlsError();
      }
      return request.url === httpUrl
        ? xml(rss("HTTP Feed", "http://93.184.216.34/", "Fallback path"))
        : new Error(`unexpected fetch: ${request.url}`);
    });

    const result = await succeeds(effect);

    expect(result).toMatchObject({
      canonicalUrl: httpUrl,
      canonicalFeedUrl: httpUrl,
      submittedUrl: publicFeedUrl,
      discoveredFromUrl: publicFeedUrl,
      discoveryProvenance: "http_fallback",
      title: "HTTP Feed",
      description: "Fallback path",
      link: "http://93.184.216.34/",
      iconUrl: null,
    });
    expect(logs.entries).toContainEqual({
      level: "warn",
      event: "discover.feed.tls_failed_retrying",
      context: { url: publicFeedUrl },
    });
  });

  test("retries a certificate failure insecurely, then over http, then gives up", async () => {
    const { effect, requested } = resolveWith(() => tlsError("CERT_HAS_EXPIRED"));

    const error = await failsWith(effect);

    expect(error).toMatchObject({
      _tag: "Unprocessable",
      code: "FEED_FETCH_FAILED",
      details: { fetchCode: "TLS_CERTIFICATE_FAILED" },
    });
    expect(requested).toEqual([
      publicFeedUrl,
      publicFeedUrl,
      "http://93.184.216.34/feed.xml",
      "http://93.184.216.34/feed.xml",
    ]);
  });

  test("autodiscovers the feed URL from HTML alternate links", async () => {
    const siteUrl = "https://93.184.216.34/";
    const feedUrl = "https://93.184.216.34/feed.xml";
    const { effect } = resolveWith((request) => {
      if (request.url === siteUrl) {
        return new Response(
          `<!doctype html><html><head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head><body></body></html>`,
          { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
        );
      }
      return request.url === feedUrl
        ? xml(rss("Example Feed", siteUrl, "Latest updates"))
        : new Error(`unexpected fetch: ${request.url}`);
    }, siteUrl);

    const result = await succeeds(effect);

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

  test("describes an HTML page with no feed link from its own metadata", async () => {
    const siteUrl = "https://93.184.216.34/";
    const { effect } = resolveWith(
      () =>
        new Response(`<!doctype html><html><head><title>Just a page</title></head></html>`, {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
      siteUrl,
    );

    const result = await succeeds(effect);

    expect(result).toMatchObject({
      canonicalUrl: siteUrl,
      discoveryProvenance: "html_metadata_fallback",
      title: "Just a page",
    });
  });

  test("tries the site root when a /feed URL is a 404", async () => {
    const feedUrl = "https://93.184.216.34/blog/feed";
    const baseUrl = "https://93.184.216.34/blog/";
    const { effect, logs } = resolveWith(
      (request) =>
        request.url === feedUrl
          ? new Response("missing", { status: 404 })
          : xml(rss("Blog", baseUrl)),
      feedUrl,
    );

    const result = await succeeds(effect);

    expect(result).toMatchObject({
      discoveredFromUrl: feedUrl,
      discoveryProvenance: "base_url_fallback",
      title: "Blog",
    });
    expect(logs.entries.map((entry) => entry.event)).toContain(
      "discover.feed.fallback_to_base_url",
    );
  });

  test("reports a failed fetch with its code and status, and logs it", async () => {
    const { effect, logs } = resolveWith(() => new Response("nope", { status: 503 }));

    const error = await failsWith(effect);

    expect(error).toMatchObject({
      _tag: "Unprocessable",
      code: "FEED_FETCH_FAILED",
      message: "Could not fetch feed",
      details: { fetchCode: "HTTP_ERROR", fetchError: "HTTP 503", fetchStatus: 503 },
    });
    expect(logs.entries.map((entry) => entry.event)).toContain("discover.feed.fetch_failed");
  });

  test("refuses a response over the size limit", async () => {
    const { effect } = resolveWith(
      () =>
        new Response("x", {
          status: 200,
          headers: { "content-length": String(3 * 1024 * 1024) },
        }),
    );

    expect(await failsWith(effect)).toMatchObject({
      details: { fetchCode: "RESPONSE_TOO_LARGE" },
    });
  });

  test("gives up on a server that never answers with a gateway timeout", async () => {
    const { effect } = resolveWith(() => new Promise<Response>(() => {}));

    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(Effect.flip(effect));
        yield* Effect.yieldNow;
        yield* TestClock.adjust(12_000);
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(TestClock.layer())),
    );

    expect(error).toMatchObject({
      _tag: "GatewayTimeout",
      code: "FEED_FETCH_FAILED",
      details: { fetchCode: "FETCH_TIMEOUT" },
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
