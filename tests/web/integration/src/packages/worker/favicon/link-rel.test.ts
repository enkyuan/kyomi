import {
  findIconFromHtml,
  findIconsFromHtml,
  linkRelDeclaresSiteIcon,
} from "@kyomi/worker/favicon";
import { afterEach, describe, expect, test, vi } from "vitest";

describe("linkRelDeclaresSiteIcon", () => {
  test("accepts standard icon rel values", () => {
    expect(linkRelDeclaresSiteIcon("icon")).toBe(true);
    expect(linkRelDeclaresSiteIcon("shortcut icon")).toBe(true);
    expect(linkRelDeclaresSiteIcon("ICON")).toBe(true);
  });

  test("accepts apple-touch icons but rejects mask tokens that contain icon", () => {
    expect(linkRelDeclaresSiteIcon("apple-touch-icon")).toBe(true);
    expect(linkRelDeclaresSiteIcon("apple-touch-icon-precomposed")).toBe(true);
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

  test("parses and ranks quoted and unquoted icon attributes by likely quality", async () => {
    globalThis.fetch = vi.fn().mockImplementation(
      async () =>
        new Response(
          `<html><head>
            <link rel=icon href=/favicon.ico sizes="32x32">
            <link rel="icon" href="https://cdn.example.com/favicon-96.png" sizes="96x96">
            <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
            <link rel="mask-icon" href="/mask.svg">
          </head></html>`,
          { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
        ),
    );

    const urls = await findIconsFromHtml("https://1.1.1.1");
    expect(urls).toEqual([
      "https://1.1.1.1/apple-touch-icon.png",
      "https://cdn.example.com/favicon-96.png",
      "https://1.1.1.1/favicon.ico",
    ]);

    const first = await findIconFromHtml("https://1.1.1.1");
    expect(first).toBe("https://1.1.1.1/apple-touch-icon.png");
  });
});
