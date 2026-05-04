import { describe, expect, test } from "vitest";
import { createReaderDocument } from "../../src/webview/create-document";

describe("createReaderDocument", () => {
  test("renders html reader content into a full document", () => {
    const document = createReaderDocument({
      reader: {
        bodyKind: "html",
        contentHtml: "<p>Hello</p>",
        contentBaseUrl: "https://example.com/posts/1",
      },
      preferences: { fontSizePx: 19 },
    });

    expect(document).toContain("<!doctype html>");
    expect(document).toContain("<p>Hello</p>");
    expect(document).toContain('<base href="https://example.com/posts/1">');
    expect(document).toContain("--reader-font-size: 19px");
  });

  test("hides images when preferences disable them", () => {
    const document = createReaderDocument({
      reader: {
        bodyKind: "html",
        contentHtml: '<figure><img src="https://example.com/a.jpg"></figure>',
      },
      preferences: { showImages: false },
    });

    expect(document).toContain("display: none !important");
  });
});
