import { findIconFromHtml, findIconsFromHtml, linkRelDeclaresSiteIcon } from "@vols.rss/favicon";
import { afterEach, describe, expect, test, vi } from "vitest";

describe("linkRelDeclaresSiteIcon", () => {
  test("accepts standard icon rel values", () => {
    expect(linkRelDeclaresSiteIcon("icon")).toBe(true);
    expect(linkRelDeclaresSiteIcon("shortcut icon")).toBe(true);
    expect(linkRelDeclaresSiteIcon("ICON")).toBe(true);
  });

  test("rejects apple-touch and mask tokens that contain the substring icon", () => {
    expect(linkRelDeclaresSiteIcon("apple-touch-icon")).toBe(false);
    expect(linkRelDeclaresSiteIcon("mask-icon")).toBe(false);
  });

  test("rejects unrelated rel tokens", () => {
    expect(linkRelDeclaresSiteIcon("canonical")).toBe(false);
    expect(linkRelDeclaresSiteIcon("stylesheet")).toBe(false);
  });
});

describe("findIconsFromHtml", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("parses quoted and unquoted icon attributes in order", async () => {
    globalThis.fetch = vi.fn().mockImplementation(
      async () =>
        new Response(
          `<html><head>
            <link rel=icon href=/favicon.ico>
            <link rel="icon" href="https://cdn.example.com/favicon-32.png">
          </head></html>`,
          { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
        ),
    );

    const urls = await findIconsFromHtml("https://1.1.1.1");
    expect(urls).toEqual(["https://1.1.1.1/favicon.ico", "https://cdn.example.com/favicon-32.png"]);

    const first = await findIconFromHtml("https://1.1.1.1");
    expect(first).toBe("https://1.1.1.1/favicon.ico");
  });
});
