// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { RenderMarkdown } from "@kyomi/reader/web";
import corpus from "./markdown-corpus.json";

/**
 * These fixtures are the migration golden corpus. Each expected fragment records
 * the TanStack output that is allowed for the documented syntax profile.
 */
describe("reader Markdown migration corpus", () => {
  test.each(corpus)("matches the $name golden output", ({ source, expectedHtml }) => {
    const { container } = render(
      <RenderMarkdown
        markdown={source}
        baseUrl="https://example.com/posts/entry"
        openLinksInNewTab
        showLinkPreviews={false}
      />,
    );

    expect(container.innerHTML).toContain(expectedHtml);
  });
});
