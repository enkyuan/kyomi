import { afterEach, describe, expect, test } from "bun:test";
import { handleReaderImageRequest } from "@modules/articles/reader/assets/handler";

const SAFE_IMAGE_URL = "https://93.184.216.34/article-image.jpg";
const originalFetch = globalThis.fetch;
const SANDBOX_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox";

function readerImageRequest(rawUrl: string | null) {
  const url = new URL("https://kyomi.test/api/reader-image");
  if (rawUrl !== null) {
    url.searchParams.set("url", rawUrl);
  }
  return new Request(url);
}

function expectSandboxedImageHeaders(response: Response) {
  expect(response.headers.get("content-security-policy")).toBe(SANDBOX_CSP);
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
}

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    return await handler(url);
  }) as typeof fetch;
  return calls;
}

describe("reader image proxy", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("serves a bounded image fetched through the SSRF-safe redirect policy", async () => {
    const bytes = new Uint8Array([255, 216, 255, 224]);
    const calls = mockFetch((url) => {
      expect(url).toBe(SAFE_IMAGE_URL);
      return new Response(bytes, { headers: { "content-type": "image/jpeg" } });
    });

    const response = await handleReaderImageRequest(readerImageRequest(SAFE_IMAGE_URL));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toContain("max-age=86400");
    expectSandboxedImageHeaders(response);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(calls).toEqual([SAFE_IMAGE_URL]);
  });

  test("serves PNG bytes unchanged with sandboxing headers", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    mockFetch(
      () => new Response(bytes, { headers: { "content-type": "image/png; charset=binary" } }),
    );

    const response = await handleReaderImageRequest(
      readerImageRequest("https://93.184.216.34/diagram.png"),
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
    mockFetch(() => new Response(svg, { headers: { "content-type": "image/svg+xml" } }));

    const response = await handleReaderImageRequest(
      readerImageRequest("https://93.184.216.34/payload.svg"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/svg+xml");
    expectSandboxedImageHeaders(response);
    expect(response.headers.get("content-security-policy")).not.toContain("allow-scripts");
    expect(await response.text()).toBe(svg);
  });

  test("does not fetch private-network targets", async () => {
    const calls = mockFetch(() => new Response("unexpected"));

    const response = await handleReaderImageRequest(
      readerImageRequest("http://localhost/private-image.png"),
    );

    expect(response.status).toBe(404);
    expect(calls).toEqual([]);
  });

  test("rejects non-image and oversized upstream responses", async () => {
    mockFetch((url) => {
      if (url.endsWith("not-an-image")) {
        return new Response("<html>not an image</html>", {
          headers: { "content-type": "text/html" },
        });
      }
      return new Response(null, {
        headers: {
          "content-length": String(8 * 1024 * 1024 + 1),
          "content-type": "image/jpeg",
        },
      });
    });

    const nonImage = await handleReaderImageRequest(
      readerImageRequest("https://93.184.216.34/not-an-image"),
    );
    const oversized = await handleReaderImageRequest(
      readerImageRequest("https://93.184.216.34/oversized-image.jpg"),
    );

    expect(nonImage.status).toBe(404);
    expect(await nonImage.text()).toBe("");
    expect(oversized.status).toBe(404);
  });
});
