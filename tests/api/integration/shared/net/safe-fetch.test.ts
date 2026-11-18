import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import type { HttpClient } from "effect/http";
import { HostResolver } from "@shared/net/outbound";
import { safeFetch } from "@shared/net/safe-fetch";
import { scriptedHttpClient, type ScriptedRequest } from "@api-tests/support/http";

const PUBLIC = "93.184.216.34";

/**
 * `safeFetch` over a scripted network. `resolve` answers DNS per hostname; unknown hosts resolve
 * to a public address.
 */
function fetching(
  respond: (request: ScriptedRequest) => Response,
  resolve: Record<string, string> = {},
) {
  const requests: ScriptedRequest[] = [];
  const run = <A, E>(effect: Effect.Effect<A, E, HttpClient.HttpClient>) =>
    Effect.runPromise(
      effect.pipe(
        Effect.provideService(HostResolver, (hostname) =>
          Effect.succeed([resolve[hostname] ?? PUBLIC]),
        ),
        Effect.provide(
          scriptedHttpClient((request) => {
            requests.push(request);
            return respond(request);
          }),
        ),
      ),
    );
  return { requests, run };
}

const fetchUrl = (url: string, options?: Parameters<typeof safeFetch>[1]) =>
  safeFetch(new URL(url), options).pipe(
    Effect.scoped,
    Effect.map(({ response, finalUrl }) => ({
      status: response.status,
      finalUrl: finalUrl.href,
    })),
  );

const redirect = (location: string) => new Response(null, { status: 302, headers: { location } });

describe("safeFetch", () => {
  test("returns the response and final URL of a public host", async () => {
    const { requests, run } = fetching(() => new Response("ok"));

    const result = await run(
      fetchUrl("https://example.com/feed.xml", { headers: { accept: "x" } }),
    );

    expect(result).toEqual({ status: 200, finalUrl: "https://example.com/feed.xml" });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.headers.accept).toBe("x");
  });

  test("follows redirects hop by hop and reports the final URL", async () => {
    const { requests, run } = fetching((request) =>
      request.url === "https://example.com/a" ? redirect("/b") : new Response("done"),
    );

    const result = await run(fetchUrl("https://example.com/a"));

    expect(result.finalUrl).toBe("https://example.com/b");
    expect(requests.map((request) => request.url)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  test("never requests a target that resolves to a private address", async () => {
    const { requests, run } = fetching(() => new Response("secret"), {
      "internal.example.com": "10.0.0.5",
    });

    const error = await run(Effect.flip(fetchUrl("https://internal.example.com/")));

    expect(error).toMatchObject({ _tag: "UnsafeOutboundUrl" });
    expect(requests).toEqual([]);
  });

  test("a redirect into the private network is stopped before it is requested", async () => {
    const { requests, run } = fetching(
      (request) =>
        request.url === "https://example.com/a"
          ? redirect("https://rebind.example.com/")
          : new Response("secret"),
      { "rebind.example.com": "127.0.0.1" },
    );

    const error = await run(Effect.flip(fetchUrl("https://example.com/a")));

    expect(error).toMatchObject({ _tag: "UnsafeOutboundUrl" });
    expect(requests.map((request) => request.url)).toEqual(["https://example.com/a"]);
  });

  test("fails with TooManyRedirects past the limit", async () => {
    const { requests, run } = fetching(() => redirect("/again"));

    const error = await run(Effect.flip(fetchUrl("https://example.com/loop", { maxRedirects: 2 })));

    expect(error).toMatchObject({ _tag: "TooManyRedirects", maxRedirects: 2 });
    expect(requests).toHaveLength(3);
  });

  test("a non-http redirect target is rejected as unsafe", async () => {
    const { run } = fetching(() => redirect("file:///etc/passwd"));

    expect(await run(Effect.flip(fetchUrl("https://example.com/a")))).toMatchObject({
      _tag: "UnsafeOutboundUrl",
    });
  });

  test("a first URL that is not http(s) is refused before any request", async () => {
    const { requests, run } = fetching(() => new Response("ok"));

    for (const url of ["file:///etc/passwd", "ftp://example.com/feed", "gopher://example.com/"]) {
      expect(await run(Effect.flip(fetchUrl(url)))).toMatchObject({ _tag: "UnsafeOutboundUrl" });
    }
    expect(requests).toEqual([]);
  });

  test("a transport failure is an UpstreamError", async () => {
    const run = (effect: Effect.Effect<unknown, unknown, HttpClient.HttpClient>) =>
      Effect.runPromise(
        Effect.flip(effect).pipe(
          Effect.provideService(HostResolver, () => Effect.succeed([PUBLIC])),
          Effect.provide(Layer.mergeAll(scriptedHttpClient(() => new Error("connection refused")))),
        ),
      );

    expect(await run(fetchUrl("https://example.com/"))).toMatchObject({
      _tag: "UpstreamError",
      operation: "outbound fetch",
    });
  });
});
