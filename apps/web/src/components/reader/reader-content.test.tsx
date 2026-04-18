// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ReaderContent } from "./reader-content";
import type { ReaderContent as ReaderContentModel } from "./reader-types";

function baseReader(overrides: Partial<ReaderContentModel> = {}): ReaderContentModel {
  return {
    contentStatus: "ready",
    contentSource: "feed_markdown",
    bodyKind: "markdown",
    title: "Title",
    byline: null,
    excerpt: null,
    contentHtml: null,
    contentMarkdown: null,
    contentText: null,
    fallbackSummary: null,
    fallbackReason: null,
    siteName: null,
    language: null,
    publishedTime: null,
    notice: null,
    extractionErrorCode: null,
    extractionErrorMessage: null,
    shouldExtract: false,
    ...overrides,
  };
}

describe("ReaderContent", () => {
  test("renders markdown tables, fenced code, and math intentionally", () => {
    render(
      <ReaderContent
        reader={baseReader({
          contentMarkdown: [
            "# Heading",
            "",
            "| A | B |",
            "| - | - |",
            "| 1 | 2 |",
            "",
            "```ts",
            "const value = 1;",
            "```",
            "",
            "$$x^2$$",
          ].join("\n"),
        })}
      />,
    );

    expect(screen.getByText("Heading")).toBeTruthy();
    expect(document.querySelector("table")).toBeTruthy();
    expect(screen.getByText("const value = 1;")).toBeTruthy();
    expect(document.querySelector(".katex")).toBeTruthy();
  });

  test("renders safe inline html tags from markdown as markup, not literal text", () => {
    render(
      <ReaderContent
        reader={baseReader({
          contentMarkdown: "Use <code>AllocationRecord</code> for this schema.",
        })}
      />,
    );

    expect(screen.getByText("AllocationRecord")).toBeTruthy();
    expect(document.querySelector("code")?.textContent).toBe("AllocationRecord");
    expect(screen.queryByText("<code>AllocationRecord</code>")).toBeNull();
  });

  test("unwraps inline markdown where backticks wrap a literal <code>…</code> string", () => {
    const { container } = render(
      <ReaderContent
        reader={baseReader({
          contentMarkdown: "Use `<code>AllocationRecord</code>` for this schema.",
        })}
      />,
    );

    expect(within(container).getByText("AllocationRecord")).toBeTruthy();
    expect(container.querySelector("p code")?.textContent).toBe("AllocationRecord");
  });

  test("renders link-only fallback without surfacing raw backend errors", () => {
    render(
      <ReaderContent
        reader={baseReader({
          contentStatus: "failed",
          contentSource: "link_only",
          bodyKind: "fallback",
          contentMarkdown: null,
          fallbackSummary: null,
          notice: "This source could not be previewed in the reader.",
          extractionErrorCode: "TIMEOUT",
          extractionErrorMessage: "socket timeout",
        })}
      />,
    );

    expect(screen.getByText("This source could not be previewed in the reader.")).toBeTruthy();
    expect(screen.queryByText("socket timeout")).toBeNull();
  });
});
