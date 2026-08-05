import { afterEach, describe, expect, test } from "bun:test";
import { handleReaderImageRequest } from "@modules/articles/reader/assets/handler";

const SAFE_IMAGE_URL = "https://93.184.216.34/article-image.jpg";
const originalFetch = globalThis.fetch;

function readerImageRequest(rawUrl: string | null) {
  const url = new URL("https://kyomi.test/api/reader-image");
  if (rawUrl !== null) {
    url.searchParams.set("url", rawUrl);
  }
  return new Request(url);
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
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(calls).toEqual([SAFE_IMAGE_URL]);
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
    expect(oversized.status).toBe(404);
  });
});
