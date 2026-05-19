import { describe, expect, test } from "vitest";
import { stripDangerousMarkupForWebViewFragment } from "@vols.rss/reader/webview";

describe("stripDangerousMarkupForWebViewFragment", () => {
  test("removes script tags", () => {
    const html = "<p>x</p><script>evil()</script><p>y</p>";
    expect(stripDangerousMarkupForWebViewFragment(html)).not.toContain("<script");
    expect(stripDangerousMarkupForWebViewFragment(html)).toContain("<p>x</p>");
    expect(stripDangerousMarkupForWebViewFragment(html)).toContain("<p>y</p>");
  });

  test("strips inline event handlers", () => {
    const html = '<img src="x" onerror="evil()">';
    const out = stripDangerousMarkupForWebViewFragment(html);
    expect(out).not.toContain("onerror");
  });
});
