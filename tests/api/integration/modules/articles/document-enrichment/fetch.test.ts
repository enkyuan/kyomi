import { beforeEach, describe, expect, test } from "bun:test";
import { Effect } from "effect";
import {
  fetchBounded,
  type BoundedFetchOptions,
} from "@modules/articles/document-enrichment/fetch";
import { fakeHttpClient } from "@api-tests/support/layers";

let requested: string[] = [];
beforeEach(() => {
  requested = [];
});

type Responder = (url: string) => Response | Promise<Response>;

describe("fetchBounded", () => {
  const opts: BoundedFetchOptions = { accept: "*/*", timeoutMs: 1000, maxBytes: 1024 };

  /** The failure `fetchBounded` ends with, against a network answered by `respond`. */
  const fetchFailure = (url: string, respond: Responder, options = opts) =>
    Effect.runPromise(
      Effect.flip(fetchBounded(url, options)).pipe(
        Effect.provide(
          fakeHttpClient(({ url: requestUrl }) => {
            requested.push(requestUrl);
            return respond(requestUrl);
          }),
        ),
      ),
    );

  test.each([
    "http://127.0.0.1/x",
    "http://localhost/x",
    "http://169.254.169.254/latest/meta-data",
    "http://10.0.0.5/x",
    "http://[::1]/x",
    "file:///etc/passwd",
  ])("rejects %s without fetching", async (url) => {
    const failure = await fetchFailure(url, () => new Response("secret"));
    expect(failure.retryable).toBe(false);
    expect(requested).toEqual([]);
  });

  test("rejects a redirect into a private address", async () => {
    const failure = await fetchFailure(
      "https://93.184.216.34/start",
      () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }),
    );
    expect(failure).toMatchObject({ reason: "blocked_url", retryable: false });
    expect(requested).toEqual(["https://93.184.216.34/start"]);
  });

  test("enforces the byte limit", async () => {
    expect(
      await fetchFailure("https://93.184.216.34/big", () => new Response(new Uint8Array(4096))),
    ).toMatchObject({ reason: "too_large", retryable: false });
  });

  test("a response slower than the timeout is a retryable failure", async () => {
    expect(
      await fetchFailure(
        "https://93.184.216.34/slow",
        () => new Promise<Response>(() => undefined),
        { ...opts, timeoutMs: 20 },
      ),
    ).toMatchObject({ reason: "TimeoutError", retryable: true });
  });

  test("server errors and rate limits are retryable, client errors are not", async () => {
    for (const [status, retryable] of [
      [500, true],
      [503, true],
      [429, true],
      [404, false],
      [403, false],
    ] as const) {
      expect(
        await fetchFailure("https://93.184.216.34/x", () => new Response("", { status })),
      ).toMatchObject({ reason: `status_${status}`, retryable });
    }
  });

  test("a content type that does not match is refused", async () => {
    expect(
      await fetchFailure(
        "https://93.184.216.34/x",
        () => new Response("<p>", { headers: { "content-type": "text/html" } }),
        { ...opts, contentType: /^image\// },
      ),
    ).toMatchObject({ reason: "unexpected_content_type", retryable: false });
  });
});
