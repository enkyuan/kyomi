import { afterEach, describe, expect, test } from "bun:test";
import { OPML_MAX_SOURCE_BYTES } from "@modules/opml/constants";
import { fetchOpmlDocumentFromUrl } from "@modules/opml/fetch-url";
import { AppError } from "@shared/errors/app";

const originalFetch = globalThis.fetch;
const publicOpmlUrl = "https://93.184.216.34/subscriptions.opml";

function mockedFetch(
  handler: (url: string) => Response | Promise<Response>,
): typeof globalThis.fetch {
  return (async (input: Request | string | URL) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return handler(url);
  }) as typeof globalThis.fetch;
}

describe("fetchOpmlDocumentFromUrl", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("fetches OPML XML and derives filename from the final URL", async () => {
    globalThis.fetch = mockedFetch((url) => {
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

    const result = await fetchOpmlDocumentFromUrl(publicOpmlUrl);

    expect(result).toEqual({
      xml: `<opml><body><outline xmlUrl="https://example.com/feed.xml"/></body></opml>`,
      finalUrl: "https://93.184.216.34/exports/my-feeds.xml",
      filename: "my-feeds.xml",
    });
  });

  test("rejects invalid and non-http URLs", async () => {
    await expect(fetchOpmlDocumentFromUrl("not a url")).rejects.toMatchObject({
      code: "OPML_URL_INVALID",
      status: 400,
    } satisfies Partial<AppError>);

    await expect(fetchOpmlDocumentFromUrl("file:///tmp/subscriptions.opml")).rejects.toMatchObject({
      code: "OPML_URL_INVALID",
      status: 400,
    } satisfies Partial<AppError>);
  });

  test("blocks private network URLs", async () => {
    await expect(
      fetchOpmlDocumentFromUrl("http://127.0.0.1/subscriptions.opml"),
    ).rejects.toMatchObject({
      code: "OPML_URL_BLOCKED",
      status: 400,
    } satisfies Partial<AppError>);
  });

  test("maps upstream HTTP failures to a gateway error", async () => {
    globalThis.fetch = mockedFetch(() => new Response("missing", { status: 404 }));

    await expect(fetchOpmlDocumentFromUrl(publicOpmlUrl)).rejects.toMatchObject({
      code: "OPML_URL_HTTP_ERROR",
      status: 502,
      details: { status: 404 },
    } satisfies Partial<AppError>);
  });

  test("maps fetch failures to a gateway error", async () => {
    globalThis.fetch = mockedFetch(() => {
      throw new Error("network down");
    });

    await expect(fetchOpmlDocumentFromUrl(publicOpmlUrl)).rejects.toMatchObject({
      code: "OPML_URL_FETCH_FAILED",
      status: 502,
    } satisfies Partial<AppError>);
  });

  test("maps timeouts to a gateway timeout", async () => {
    globalThis.fetch = mockedFetch(() => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    });

    await expect(fetchOpmlDocumentFromUrl(publicOpmlUrl)).rejects.toMatchObject({
      code: "OPML_URL_FETCH_TIMEOUT",
      status: 504,
    } satisfies Partial<AppError>);
  });

  test("rejects oversized remote documents", async () => {
    globalThis.fetch = mockedFetch(() => new Response("x".repeat(OPML_MAX_SOURCE_BYTES + 1)));

    await expect(fetchOpmlDocumentFromUrl(publicOpmlUrl)).rejects.toMatchObject({
      code: "OPML_TOO_LARGE",
      status: 413,
    } satisfies Partial<AppError>);
  });

  test("accepts a remote document above the 2 MiB feed-discovery limit but below 32 MiB", async () => {
    const body =
      '<opml><body><outline xmlUrl="https://example.com/feed.xml"/></body></opml>' +
      "<!-- padding -->".repeat(200_000);
    globalThis.fetch = mockedFetch(
      () => new Response(body, { status: 200, headers: { "content-type": "application/xml" } }),
    );

    const result = await fetchOpmlDocumentFromUrl(publicOpmlUrl);
    expect(Buffer.byteLength(result.xml, "utf8")).toBeGreaterThan(2 * 1024 * 1024);
    expect(Buffer.byteLength(result.xml, "utf8")).toBeLessThan(OPML_MAX_SOURCE_BYTES);
  });
});
