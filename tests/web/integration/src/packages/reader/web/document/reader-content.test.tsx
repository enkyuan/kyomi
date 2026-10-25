// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  hasReaderContentBody,
  parseReaderDocument,
  ReaderContent,
  type ReaderDocumentContent,
} from "@kyomi/reader/web";
import { documentOf, text } from "./fixtures";

const document_ = documentOf([{ type: "paragraph", children: [text("From the document")] }]);

function reader(overrides: Partial<ReaderDocumentContent> = {}): ReaderDocumentContent {
  return {
    bodyKind: "document",
    document: document_,
    documentVersion: 1,
    contentHtml: "<p>From the HTML</p>",
    contentBaseUrl: "https://example.com/post",
    contentStatus: "ready",
    contentSource: "extracted_html",
    notice: null,
    ...overrides,
  };
}

describe("ReaderContent with a document body", () => {
  test("renders the KDM renderer for a supported document", () => {
    const { container } = render(<ReaderContent reader={reader()} />);
    expect(container.querySelector("[data-reader-document]")?.textContent).toBe(
      "From the document",
    );
    expect(container.textContent).not.toContain("From the HTML");
  });

  test("forwards reader preferences to the document renderer", () => {
    const withLink = documentOf([
      {
        type: "paragraph",
        children: [{ type: "link", href: "https://example.org/", children: [text("out")] }],
      },
    ]);
    const { container } = render(
      <ReaderContent
        openLinksInNewTab={false}
        reader={reader({ document: withLink })}
        showLinkPreviews={false}
      />,
    );
    expect(container.querySelector("a")?.hasAttribute("target")).toBe(false);
  });

  test("shows the notice above the document", () => {
    render(<ReaderContent reader={reader({ notice: "Partial content" })} />);
    expect(screen.getByText("Partial content")).toBeTruthy();
  });

  test.each([
    ["a newer schema version", { ...document_, version: 2 }],
    ["a malformed document", { version: 1, blocks: "nope" }],
    ["a missing document", undefined],
  ])("falls back to the HTML body for %s", async (_label, document) => {
    const { container } = render(<ReaderContent reader={reader({ document })} />);
    await waitFor(() => expect(container.textContent).toContain("From the HTML"));
    expect(container.querySelector("[data-reader-document]")).toBeNull();
  });

  test("shows the fallback view when an unusable document has no HTML body either", () => {
    render(
      <ReaderContent
        reader={reader({
          document: undefined,
          contentHtml: "",
          fallbackSummary: "Summary only",
        })}
      />,
    );
    expect(screen.getByText("Summary only")).toBeTruthy();
  });

  test("hasReaderContentBody reflects whether anything can be rendered", () => {
    expect(hasReaderContentBody(reader())).toBe(true);
    expect(hasReaderContentBody(reader({ document: undefined }))).toBe(true);
    expect(hasReaderContentBody(reader({ document: undefined, contentHtml: " " }))).toBe(false);
  });

  test("validates a fetched document once, not on every render", () => {
    const payload = JSON.parse(JSON.stringify(document_));
    const first = parseReaderDocument(payload);
    expect(first).not.toBeNull();
    expect(parseReaderDocument(payload)).toBe(first);
    expect(parseReaderDocument({ ...payload, version: 0 })).toBeNull();
  });
});
