import { describe, expect, test } from "bun:test";
import { Effect, Fiber, Layer } from "effect";
import { TestClock } from "effect/testing";
import { fetchArticleDocument, withHostRateLimit } from "@modules/articles/reader/extraction/fetch";
import { fakeHttpClient } from "@api-tests/support/layers";

const URL_UNDER_TEST = "https://93.184.216.34/post";
const html = (body: string, headers: Record<string, string> = {}) =>
  new Response(body, { status: 200, headers: { "content-type": "text/html", ...headers } });

/** Fetch `url` against a fake HTTP client and return the typed failure (or the document). */
function fetchWith(
  respond: (request: { method: string; url: string }) => Response | Promise<Response>,
  url = URL_UNDER_TEST,
) {
  const requests: string[] = [];
  const client = fakeHttpClient((request) => {
    requests.push(request.url);
    return respond(request);
  });
  return {
    requests,
    result: Effect.runPromise(
      Effect.result(fetchArticleDocument(url)).pipe(Effect.provide(client)),
    ),
  };
}

const failureOf = async (run: ReturnType<typeof fetchWith>) => {
  const result = await run.result;
  if (result._tag !== "Failure") {
    throw new Error("expected the fetch to fail");
  }
  return result.failure;
};

describe("article document fetch", () => {
  test("returns the body, content type and final URL of a readable page", async () => {
    const run = fetchWith(() => html("<p>hello</p>"));

    const result = await run.result;

    expect(result).toMatchObject({
      _tag: "Success",
      success: { finalUrl: URL_UNDER_TEST, body: "<p>hello</p>", contentType: "text/html" },
    });
  });

  test("follows a redirect and reports the final URL", async () => {
    const run = fetchWith((request) =>
      request.url.endsWith("/post")
        ? new Response(null, { status: 301, headers: { location: "/moved" } })
        : html("<p>moved</p>"),
    );

    const result = await run.result;

    expect(run.requests).toEqual([URL_UNDER_TEST, "https://93.184.216.34/moved"]);
    expect(result).toMatchObject({
      _tag: "Success",
      success: { finalUrl: "https://93.184.216.34/moved", body: "<p>moved</p>" },
    });
  });

  test("rejects a URL that is not http(s) without requesting it", async () => {
    const run = fetchWith(() => html("unused"), "ftp://93.184.216.34/post");

    expect(await failureOf(run)).toMatchObject({
      _tag: "ExtractionFailed",
      errorCode: "BLOCKED_URL",
      errorMessage: "Invalid or unsafe URL provided.",
    });
    expect(run.requests).toEqual([]);
  });

  test("blocks a redirect into the private network", async () => {
    const run = fetchWith(
      () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }),
    );

    expect(await failureOf(run)).toMatchObject({ errorCode: "BLOCKED_URL" });
    expect(run.requests).toEqual([URL_UNDER_TEST]);
  });

  test("gives up after too many redirects", async () => {
    const run = fetchWith(
      () => new Response(null, { status: 302, headers: { location: "/again" } }),
    );

    expect(await failureOf(run)).toMatchObject({
      errorCode: "FETCH_FAILED",
      errorMessage: "Extraction failed: Too many redirects.",
    });
    expect(run.requests).toHaveLength(6);
  });

  test("reports an error status", async () => {
    const run = fetchWith(() => new Response("nope", { status: 404 }));

    expect(await failureOf(run)).toMatchObject({
      errorCode: "FETCH_FAILED",
      errorMessage: "Extraction failed (HTTP 404).",
    });
  });

  test("rejects a page that is not an HTML or text document", async () => {
    const run = fetchWith(
      () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    );

    expect(await failureOf(run)).toMatchObject({ errorCode: "NOT_HTML" });
  });

  test("rejects a page whose declared length is over the limit", async () => {
    const run = fetchWith(() => html("small", { "content-length": String(4 * 1024 * 1024) }));

    expect(await failureOf(run)).toMatchObject({ errorCode: "TOO_LARGE" });
  });

  test("rejects a streamed page that grows past the limit", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    const run = fetchWith(
      () =>
        new Response(
          new ReadableStream({
            start(controller) {
              for (let index = 0; index < 4; index += 1) {
                controller.enqueue(chunk);
              }
              controller.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/html" } },
        ),
    );

    expect(await failureOf(run)).toMatchObject({ errorCode: "TOO_LARGE" });
  });

  test("a response that never arrives fails with TIMEOUT after 12 seconds", async () => {
    const never = fakeHttpClient(() => new Promise<Response>(() => undefined));
    const program = Effect.gen(function* () {
      const fiber = yield* Effect.forkChild(Effect.flip(fetchArticleDocument(URL_UNDER_TEST)));
      yield* Effect.yieldNow;
      yield* TestClock.adjust("12 seconds");
      return yield* Fiber.join(fiber);
    }).pipe(Effect.provide(Layer.mergeAll(never, TestClock.layer())));

    expect(await Effect.runPromise(program)).toMatchObject({
      _tag: "ExtractionFailed",
      errorCode: "TIMEOUT",
      errorMessage: "Full preview unavailable right now.",
    });
  });
});

describe("host rate limit", () => {
  test("runs the effect inside the limiter and returns its value", async () => {
    const held: string[] = [];

    const value = await Effect.runPromise(
      withHostRateLimit(
        {
          run: async (url, task) => {
            held.push(url);
            return task();
          },
        },
        URL_UNDER_TEST,
        Effect.succeed("done"),
      ),
    );

    expect(value).toBe("done");
    expect(held).toEqual([URL_UNDER_TEST]);
  });

  test("keeps the wrapped effect's own typed failure", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        withHostRateLimit({ run: (_url, task) => task() }, URL_UNDER_TEST, Effect.fail("boom")),
      ),
    );

    expect(failure).toBe("boom");
  });

  test("a limiter failure is a typed RedisError", async () => {
    const failure = await Effect.runPromise(
      Effect.flip(
        withHostRateLimit(
          {
            run: async () => {
              throw new Error("redis down");
            },
          },
          URL_UNDER_TEST,
          Effect.succeed("unused"),
        ),
      ),
    );

    expect(failure).toMatchObject({ _tag: "RedisError", operation: "host rate limit" });
  });
});
