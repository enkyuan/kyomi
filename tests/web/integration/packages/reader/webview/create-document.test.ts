import { describe, expect, test } from "vitest";
import { createReaderDocument } from "@kyomi/reader/webview";

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

  test("renders markdown as HTML (not escaped pre)", () => {
    const document = createReaderDocument({
      reader: {
        bodyKind: "markdown",
        contentMarkdown: "# Hi\n\n**Bold**",
        contentBaseUrl: "https://example.com/",
      },
    });

    expect(document).not.toContain("<pre>&lt;");
    expect(document).toContain("<h1");
    expect(document).toContain("Bold");
  });

  test("strips injected script content from article html (bridge script remains)", () => {
    const document = createReaderDocument({
      reader: {
        bodyKind: "html",
        contentHtml: '<p>Hi</p><script>document.write("x")</script>',
      },
    });

    expect(document).not.toContain("document.write");
    expect(document).toContain("<p>Hi</p>");
    expect(document).toContain("__VOLS_RSS_READER_READY__");
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
