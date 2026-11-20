import { describe, expect, spyOn, test } from "bun:test";
import { Effect, Fiber, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientError } from "effect/http";
import { TestClock } from "effect/testing";
import { OPML_MAX_SOURCE_BYTES } from "@modules/opml/constants";
import { fetchOpmlDocumentFromUrl } from "@modules/opml/fetch";
import { UpstreamError } from "@shared/effect/errors";
import { HostResolver } from "@shared/net/outbound";
import { fakeHttpClient } from "@api-tests/support/layers";
import { failureWith, runWith } from "./fixtures";

const publicOpmlUrl = "https://93.184.216.34/subscriptions.opml";

/** An `HttpClient` whose transport fails with `cause`, like fetch rejecting. */
const failingHttpClient = (cause: unknown) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.fail(
        new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({ request, cause }),
        }),
      ),
    ),
  );

describe("fetchOpmlDocumentFromUrl", () => {
  test("fetches OPML XML and derives filename from the final URL", async () => {
    const requested: string[] = [];
    const layer = fakeHttpClient(({ url }) => {
      requested.push(url);
      if (url === publicOpmlUrl) {
        return new Response(null, {
          status: 302,
          headers: { location: "/exports/my-feeds.xml" },
        });
      }
      if (url === "https://93.184.216.34/exports/my-feeds.xml") {
        return new Response(
          `<opml><body><outline xmlUrl="https://example.com/feed.xml"/></body></opml>`,
          { status: 200, headers: { "content-type": "application/xml" } },
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    const result = await runWith(fetchOpmlDocumentFromUrl(publicOpmlUrl), layer);

    expect(result).toEqual({
      xml: `<opml><body><outline xmlUrl="https://example.com/feed.xml"/></body></opml>`,
      finalUrl: "https://93.184.216.34/exports/my-feeds.xml",
      filename: "my-feeds.xml",
    });
    expect(requested).toEqual([publicOpmlUrl, "https://93.184.216.34/exports/my-feeds.xml"]);
  });

  test("rejects invalid and non-http URLs before any request", async () => {
    const layer = fakeHttpClient(() => {
      throw new Error("must not be called");
    });

    for (const url of ["not a url", "file:///tmp/subscriptions.opml"]) {
      expect(await failureWith(fetchOpmlDocumentFromUrl(url), layer)).toMatchObject({
        _tag: "BadRequest",
        code: "OPML_URL_INVALID",
      });
    }
  });

  test("blocks private network URLs without sending a request", async () => {
    const layer = fakeHttpClient(() => {
      throw new Error("must not be called");
    });

    expect(
      await failureWith(fetchOpmlDocumentFromUrl("http://127.0.0.1/subscriptions.opml"), layer),
    ).toMatchObject({ _tag: "BadRequest", code: "OPML_URL_BLOCKED" });
  });

  test("checks the destination with the caller's HostResolver, not the system resolver", async () => {
    const layer = fakeHttpClient(() => {
      throw new Error("must not be called");
    });
    const resolvedTo = (addresses: readonly string[]) =>
      fetchOpmlDocumentFromUrl("https://feeds.example.test/subscriptions.opml").pipe(
        Effect.provideService(HostResolver, () => Effect.succeed(addresses)),
      );

    expect(await failureWith(resolvedTo(["10.0.0.8"]), layer)).toMatchObject({
      _tag: "BadRequest",
      code: "OPML_URL_BLOCKED",
    });
  });

  test("a resolver failure is a fetch failure, not a verdict on the URL", async () => {
    const layer = fakeHttpClient(() => {
      throw new Error("must not be called");
    });
    const unresolvable = fetchOpmlDocumentFromUrl(
      "https://feeds.example.test/subscriptions.opml",
    ).pipe(
      Effect.provideService(HostResolver, () =>
        Effect.fail(new UpstreamError({ operation: "resolve outbound host", cause: "ENOTFOUND" })),
      ),
    );

    expect(await failureWith(unresolvable, layer)).toMatchObject({
      _tag: "BadGateway",
      code: "OPML_URL_FETCH_FAILED",
    });
  });

  test("blocks a redirect into a private network", async () => {
    const layer = fakeHttpClient(({ url }) => {
      if (url === publicOpmlUrl) {
        return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    expect(await failureWith(fetchOpmlDocumentFromUrl(publicOpmlUrl), layer)).toMatchObject({
      code: "OPML_URL_BLOCKED",
    });
  });

  test("fails after too many redirects", async () => {
    const layer = fakeHttpClient(
      () => new Response(null, { status: 302, headers: { location: publicOpmlUrl } }),
    );

    expect(await failureWith(fetchOpmlDocumentFromUrl(publicOpmlUrl), layer)).toMatchObject({
      _tag: "BadRequest",
      code: "OPML_URL_TOO_MANY_REDIRECTS",
    });
  });

  test("maps upstream HTTP failures to a gateway error", async () => {
    const layer = fakeHttpClient(() => new Response("missing", { status: 404 }));

    expect(await failureWith(fetchOpmlDocumentFromUrl(publicOpmlUrl), layer)).toMatchObject({
      _tag: "BadGateway",
      code: "OPML_URL_HTTP_ERROR",
      details: { status: 404 },
    });
  });

  test("maps transport failures to a gateway error", async () => {
    expect(
      await failureWith(
        fetchOpmlDocumentFromUrl(publicOpmlUrl),
        failingHttpClient(new Error("network down")),
      ),
    ).toMatchObject({ _tag: "BadGateway", code: "OPML_URL_FETCH_FAILED" });
  });

  test("maps TLS verification failures by error code", async () => {
    for (const code of ["CERT_HAS_EXPIRED", "SELF_SIGNED_CERT_IN_CHAIN"]) {
      expect(
        await failureWith(
          fetchOpmlDocumentFromUrl(publicOpmlUrl),
          failingHttpClient(Object.assign(new TypeError("certificate problem"), { code })),
        ),
      ).toMatchObject({ _tag: "BadGateway", code: "OPML_URL_TLS_FAILED" });
    }
  });

  test("times out a request that never answers", async () => {
    const stalled = Layer.succeed(
      HttpClient.HttpClient,
      HttpClient.make(() => Effect.never),
    );

    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(Effect.flip(fetchOpmlDocumentFromUrl(publicOpmlUrl)));
        yield* TestClock.adjust(12_000);
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(Layer.mergeAll(stalled, TestClock.layer()))),
    );

    expect(error).toMatchObject({ _tag: "GatewayTimeout", code: "OPML_URL_FETCH_TIMEOUT" });
  });

  test("rejects oversized remote documents", async () => {
    const layer = fakeHttpClient(() => new Response("x".repeat(OPML_MAX_SOURCE_BYTES + 1)));

    expect(await failureWith(fetchOpmlDocumentFromUrl(publicOpmlUrl), layer)).toMatchObject({
      _tag: "PayloadTooLarge",
      code: "OPML_TOO_LARGE",
    });
  });

  test("rejects a document whose declared length is over the limit", async () => {
    const layer = fakeHttpClient(
      () =>
        new Response("<opml/>", {
          headers: { "content-length": String(OPML_MAX_SOURCE_BYTES + 1) },
        }),
    );

    expect(await failureWith(fetchOpmlDocumentFromUrl(publicOpmlUrl), layer)).toMatchObject({
      code: "OPML_TOO_LARGE",
    });
  });

  test("accepts a remote document above the 2 MiB feed-discovery limit but below 32 MiB", async () => {
    const body =
      '<opml><body><outline xmlUrl="https://example.com/feed.xml"/></body></opml>' +
      "<!-- padding -->".repeat(200_000);
    const layer = fakeHttpClient(
      () => new Response(body, { status: 200, headers: { "content-type": "application/xml" } }),
    );

    const result = await runWith(fetchOpmlDocumentFromUrl(publicOpmlUrl), layer);
    expect(Buffer.byteLength(result.xml, "utf8")).toBeGreaterThan(2 * 1024 * 1024);
    expect(Buffer.byteLength(result.xml, "utf8")).toBeLessThan(OPML_MAX_SOURCE_BYTES);
  });

  test("connects to the address it checked, so a name that answers differently later cannot move it", async () => {
    let lookups = 0;
    const requested: Array<{ url: string; host: string | null }> = [];
    const fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (
      input: URL | RequestInfo,
      init?: RequestInit,
    ) => {
      requested.push({ url: String(input), host: new Headers(init?.headers).get("host") });
      return new Response("<opml><body/></opml>", { status: 200 });
    }) as unknown as typeof fetch);

    try {
      await Effect.runPromise(
        fetchOpmlDocumentFromUrl("https://rebind.example/feeds.opml").pipe(
          Effect.provideService(HostResolver, () =>
            Effect.sync(() => {
              lookups += 1;
              return ["93.184.216.34"];
            }),
          ),
          Effect.provide(FetchHttpClient.layer),
        ),
      );
    } finally {
      fetchSpy.mockRestore();
    }

    expect(lookups).toBe(1);
    expect(requested).toEqual([
      { url: "https://93.184.216.34/feeds.opml", host: "rebind.example" },
    ]);
  });

  test("refuses a name that resolves into carrier-grade NAT, where cloud metadata can live", async () => {
    const layer = fakeHttpClient(() => {
      throw new Error("must not be called");
    });

    const error = await failureWith(
      fetchOpmlDocumentFromUrl("https://cgnat.example/feeds.opml").pipe(
        Effect.provideService(HostResolver, () => Effect.succeed(["100.100.100.200"])),
      ),
      layer,
    );

    expect(error).toMatchObject({ code: "OPML_URL_BLOCKED" });
  });
});
