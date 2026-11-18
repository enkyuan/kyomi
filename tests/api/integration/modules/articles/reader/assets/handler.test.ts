import { describe, expect, test } from "bun:test";
import { Effect, Fiber, Layer } from "effect";
import { HttpClient, HttpClientError } from "effect/http";
import { TestClock } from "effect/testing";
import { serveReaderImage } from "@modules/articles/reader/assets/handler";
import { fakeHttpClient, recordingLogger } from "@api-tests/support/layers";

const SAFE_IMAGE_URL = "https://93.184.216.34/article-image.jpg";
const SANDBOX_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox";

function readerImageUrl(rawUrl: string | null) {
  const url = new URL("https://kyomi.test/api/reader-image");
  if (rawUrl !== null) {
    url.searchParams.set("url", rawUrl);
  }
  return url.href;
}

function expectSandboxedImageHeaders(response: Response) {
  expect(response.headers.get("content-security-policy")).toBe(SANDBOX_CSP);
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
}

/** Runs the handler against an upstream that answers from `respond`; returns what was requested. */
async function serve(
  rawUrl: string | null,
  respond: (url: string) => Response | Promise<Response> = () => new Response("unexpected"),
) {
  const requested: string[] = [];
  const logs = recordingLogger();
  const response = await Effect.runPromise(
    serveReaderImage(readerImageUrl(rawUrl)).pipe(
      Effect.provide(
        Layer.mergeAll(
          fakeHttpClient(({ url }) => {
            requested.push(url);
            return respond(url);
          }),
          logs.layer,
        ),
      ),
    ),
  );
  return { response, requested, logs: logs.entries };
}

describe("reader image proxy", () => {
  test("serves a bounded image fetched through the SSRF-safe redirect policy", async () => {
    const bytes = new Uint8Array([255, 216, 255, 224]);

    const { response, requested } = await serve(
      SAFE_IMAGE_URL,
      () => new Response(bytes, { headers: { "content-type": "image/jpeg" } }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toContain("max-age=86400");
    expectSandboxedImageHeaders(response);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(requested).toEqual([SAFE_IMAGE_URL]);
  });

  test("serves PNG bytes unchanged with sandboxing headers", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

    const { response } = await serve(
      "https://93.184.216.34/diagram.png",
      () => new Response(bytes, { headers: { "content-type": "image/png; charset=binary" } }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expectSandboxedImageHeaders(response);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  test("sandboxes SVG responses so embedded scripts cannot run on the API origin", async () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>fetch("/api/v1/me")</script>' +
      '<circle r="4"/></svg>';

    const { response } = await serve(
      "https://93.184.216.34/payload.svg",
      () => new Response(svg, { headers: { "content-type": "image/svg+xml" } }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expectSandboxedImageHeaders(response);
    expect(response.headers.get("content-security-policy")).not.toContain("allow-scripts");
    expect(await response.text()).toBe(svg);
  });

  test("does not fetch private-network targets, and logs the blocked attempt", async () => {
    const { response, requested, logs } = await serve("http://localhost/private-image.png");

    expect(response.status).toBe(404);
    expect(requested).toEqual([]);
    expect(logs).toEqual([
      {
        level: "warn",
        event: "reader.image.miss",
        context: { reason: "blocked_url", host: "localhost" },
      },
    ]);
  });

  test("checks every redirect hop against the private-network policy", async () => {
    const { response, requested } = await serve(
      SAFE_IMAGE_URL,
      () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }),
    );

    expect(response.status).toBe(404);
    expect(requested).toEqual([SAFE_IMAGE_URL]);
  });

  test("follows a public redirect to the image", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const target = "https://93.184.216.35/final.png";

    const { response, requested } = await serve(SAFE_IMAGE_URL, (url) =>
      url === SAFE_IMAGE_URL
        ? new Response(null, { status: 301, headers: { location: target } })
        : new Response(bytes, { headers: { "content-type": "image/png" } }),
    );

    expect(response.status).toBe(200);
    expect(requested).toEqual([SAFE_IMAGE_URL, target]);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  test("gives up after too many redirects", async () => {
    const { response, requested, logs } = await serve(
      SAFE_IMAGE_URL,
      () => new Response(null, { status: 302, headers: { location: SAFE_IMAGE_URL } }),
    );

    expect(response.status).toBe(404);
    expect(requested).toHaveLength(6);
    expect(logs[0]?.context).toMatchObject({ reason: "too_many_redirects" });
  });

  test("rejects non-image and oversized upstream responses", async () => {
    const respond = (url: string) =>
      url.endsWith("not-an-image")
        ? new Response("<html>not an image</html>", { headers: { "content-type": "text/html" } })
        : new Response(null, {
            headers: {
              "content-length": String(8 * 1024 * 1024 + 1),
              "content-type": "image/jpeg",
            },
          });

    const nonImage = await serve("https://93.184.216.34/not-an-image", respond);
    const oversized = await serve("https://93.184.216.34/oversized-image.jpg", respond);

    expect(nonImage.response.status).toBe(404);
    expect(await nonImage.response.text()).toBe("");
    expect(oversized.response.status).toBe(404);
    expect(oversized.logs[0]?.context).toMatchObject({ reason: "too_large" });
  });

  test("rejects a body that outgrows the limit while streaming", async () => {
    const chunk = new Uint8Array(5 * 1024 * 1024);
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk);
        controller.enqueue(chunk);
        controller.close();
      },
    });

    const { response, logs } = await serve(
      SAFE_IMAGE_URL,
      () => new Response(body, { headers: { "content-type": "image/jpeg" } }),
    );

    expect(response.status).toBe(404);
    expect(logs[0]?.context).toMatchObject({ reason: "too_large" });
  });

  test("answers upstream error statuses with an empty 404", async () => {
    const { response } = await serve(SAFE_IMAGE_URL, () => new Response("gone", { status: 410 }));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  test("answers a transport failure with a 404 and logs it without exposing the cause", async () => {
    const logs = recordingLogger();
    const failing = Layer.succeed(
      HttpClient.HttpClient,
      HttpClient.make((request) =>
        Effect.fail(
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.TransportError({ request, cause: new Error("ECONNRESET") }),
          }),
        ),
      ),
    );

    const response = await Effect.runPromise(
      serveReaderImage(readerImageUrl(SAFE_IMAGE_URL)).pipe(
        Effect.provide(Layer.mergeAll(failing, logs.layer)),
      ),
    );

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(logs.entries).toEqual([
      {
        level: "info",
        event: "reader.image.miss",
        context: { reason: "upstream_failed", host: "93.184.216.34" },
      },
    ]);
  });

  test("stops waiting for an upstream that never answers after the deadline", async () => {
    const logs = recordingLogger();
    const hanging = Layer.succeed(
      HttpClient.HttpClient,
      HttpClient.make(() => Effect.never),
    );

    const response = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(serveReaderImage(readerImageUrl(SAFE_IMAGE_URL)));
        yield* Effect.yieldNow;
        yield* TestClock.adjust("8 seconds");
        return yield* Fiber.join(fiber);
      }).pipe(Effect.provide(Layer.mergeAll(hanging, logs.layer, TestClock.layer()))),
    );

    expect(response.status).toBe(404);
    expect(logs.entries[0]?.context).toMatchObject({ reason: "timed_out" });
  });

  test("a missing or non-http url is a client error, not an upstream fetch", async () => {
    const missing = await serve(null);
    const ftp = await serve("ftp://93.184.216.34/image.png");

    expect(missing.response.status).toBe(400);
    expect(ftp.response.status).toBe(400);
    expect(missing.requested).toEqual([]);
    expect(ftp.requested).toEqual([]);
    expect(missing.logs).toEqual([]);
  });
});
