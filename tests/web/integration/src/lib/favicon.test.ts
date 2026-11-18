// @vitest-environment node
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { proxyFavicon } from "@lib/favicon";

const API_ORIGIN = "http://api.internal:8000";
const KB = 1024;

function faviconRequest(search = "?domain=https%3A%2F%2Fexample.com&v=2", init: RequestInit = {}) {
  return new Request(`https://kyomi.test/api/favicon${search}`, init);
}

function stubApi(response: Response | (() => Response)) {
  const fetchMock = vi.fn(async () => (typeof response === "function" ? response() : response));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv("API_ORIGIN", API_ORIGIN);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("proxyFavicon", () => {
  test("never serves the type the upstream picked when it is not an image", async () => {
    stubApi(
      new Response("<script>fetch('/api/auth/get-session')</script>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );

    const response = await proxyFavicon(faviconRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/x-icon");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toBe(
      "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    );
  });

  test.each([
    ["application/octet-stream"],
    ["text/html"],
    ["application/xhtml+xml"],
    ["image/x-icon/../html"],
    [""],
  ])("serves %j as an icon", async (upstreamType) => {
    stubApi(new Response("x", { headers: { "content-type": upstreamType } }));

    const response = await proxyFavicon(faviconRequest());

    expect(response.headers.get("content-type")).toBe("image/x-icon");
  });

  test("a type that merely mentions an image is not one", async () => {
    stubApi(new Response("x", { headers: { "content-type": "text/html; x=image/png" } }));

    const response = await proxyFavicon(faviconRequest());

    expect(response.headers.get("content-type")).toBe("image/x-icon");
  });

  test("serves an image with its own type, and the bytes unchanged", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    stubApi(
      new Response(bytes, {
        headers: {
          "content-type": "Image/PNG; charset=binary",
          "cache-control": "public, max-age=604800",
        },
      }),
    );

    const response = await proxyFavicon(faviconRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("public, max-age=604800");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  });

  test("passes nothing else of the upstream response on", async () => {
    stubApi(
      new Response("x", {
        headers: {
          "content-type": "image/png",
          "set-cookie": "kyomi.session=stolen; Path=/",
          "content-disposition": "attachment; filename=evil.html",
          "content-security-policy": "default-src *",
          "x-powered-by": "api",
          location: "https://evil.example",
        },
      }),
    );

    const response = await proxyFavicon(faviconRequest());

    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(response.headers.get("x-powered-by")).toBeNull();
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
  });

  test("answers a body past 64 KiB as a miss, and stops reading it", async () => {
    let pulled = 0;
    let cancelled = false;
    const chunk = new Uint8Array(16 * KB);
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });
    stubApi(new Response(body, { headers: { "content-type": "image/png" } }));

    const response = await proxyFavicon(faviconRequest());

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBeNull();
    expect(cancelled).toBe(true);
    // 4 chunks fill the 64 KiB cap, the 5th crosses it; the stream is not drained.
    expect(pulled).toBeLessThanOrEqual(6);
  });

  test("answers a declared length past 64 KiB as a miss without reading the body", async () => {
    stubApi(
      new Response(new Uint8Array(65 * KB), {
        headers: { "content-type": "image/png", "content-length": String(65 * KB) },
      }),
    );

    const response = await proxyFavicon(faviconRequest());

    expect(response.status).toBe(404);
  });

  test("serves a body of exactly 64 KiB", async () => {
    stubApi(new Response(new Uint8Array(64 * KB), { headers: { "content-type": "image/png" } }));

    const response = await proxyFavicon(faviconRequest());

    expect(response.status).toBe(200);
    expect((await response.arrayBuffer()).byteLength).toBe(64 * KB);
  });

  test("asks only the API's favicon endpoint, with the domain and nothing from the request", async () => {
    const fetchMock = stubApi(new Response("x", { headers: { "content-type": "image/png" } }));

    await proxyFavicon(
      faviconRequest("?domain=https%3A%2F%2Fexample.com&v=2&path=%2Fapi%2Fauth%2Fsign-out", {
        headers: {
          cookie: "kyomi.session=secret",
          authorization: "Bearer secret",
          accept: "image/avif,image/*",
        },
      }),
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.href).toBe(`${API_ORIGIN}/api/favicon?domain=https%3A%2F%2Fexample.com`);
    expect(init.redirect).toBe("manual");
    expect(new Headers(init.headers).get("cookie")).toBeNull();
    expect(new Headers(init.headers).get("authorization")).toBeNull();
    expect(new Headers(init.headers).get("accept")).toBe("image/avif,image/*");
  });

  test("cannot be pointed at another host through the domain", async () => {
    const fetchMock = stubApi(new Response("x", { headers: { "content-type": "image/png" } }));

    await proxyFavicon(faviconRequest("?domain=%2F%2Fevil.example%2Fx%23&domain=http%3A%2F%2Fa"));

    const [url] = fetchMock.mock.calls[0] as unknown as [URL];
    expect(url.origin).toBe(API_ORIGIN);
    expect(url.pathname).toBe("/api/favicon");
  });

  test("rejects a request without a domain before calling the API", async () => {
    const fetchMock = stubApi(new Response("x"));

    const response = await proxyFavicon(faviconRequest(""));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("keeps a miss a miss, with its cache lifetime but no body type", async () => {
    stubApi(
      new Response("<h1>not found</h1>", {
        status: 404,
        headers: { "content-type": "text/html", "cache-control": "public, max-age=120" },
      }),
    );

    const response = await proxyFavicon(faviconRequest());

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("public, max-age=120");
    expect(response.headers.get("content-type")).toBeNull();
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe("");
  });

  test.each([301, 302, 500, 503])("turns an upstream %i into a bad gateway", async (status) => {
    stubApi(new Response(null, { status, headers: { location: "https://evil.example" } }));

    const response = await proxyFavicon(faviconRequest());

    expect(response.status).toBe(502);
    expect(response.headers.get("location")).toBeNull();
  });

  test("answers a bad gateway when the API cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    const response = await proxyFavicon(faviconRequest());

    expect(response.status).toBe(502);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("answers a bad gateway when the connection drops after the headers", async () => {
    let sent = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent) {
          controller.error(new Error("socket reset"));
          return;
        }
        sent = true;
        controller.enqueue(new Uint8Array(8));
      },
    });
    stubApi(new Response(body, { headers: { "content-type": "image/png" } }));

    const response = await proxyFavicon(faviconRequest());

    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toBeNull();
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect(await response.text()).toBe("");
  });

  test("answers a bad gateway when the timeout fires while the body is still being read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: URL, init: RequestInit) => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            // The timeout fires after the headers: the signal is already aborted by the first read.
            const fail = () => controller.error(init.signal?.reason);
            if (init.signal?.aborted) fail();
            else init.signal?.addEventListener("abort", fail);
          },
        });
        return new Response(body, { headers: { "content-type": "image/png" } });
      }),
    );
    vi.spyOn(AbortSignal, "timeout").mockImplementation(() =>
      AbortSignal.abort(new DOMException("The operation timed out.", "TimeoutError")),
    );

    const response = await proxyFavicon(faviconRequest());

    expect(response.status).toBe(502);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  test("still serves an icon whose body arrives in several chunks", async () => {
    const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4])];
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const next = chunks.shift();
        if (next) {
          controller.enqueue(next);
        } else {
          controller.close();
        }
      },
    });
    stubApi(new Response(body, { headers: { "content-type": "image/png" } }));

    const response = await proxyFavicon(faviconRequest());

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3, 4]));
  });
});
