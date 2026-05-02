import { describe, expect, test } from "bun:test";
import { normalizeMarkdownFeedArtifacts } from "@modules/articles/reader/markdown-artifacts";

describe("normalizeMarkdownFeedArtifacts", () => {
  test("strips trailing ATX hash marks from headings", () => {
    expect(normalizeMarkdownFeedArtifacts("## Release notes ##\n\nHello")).toBe(
      "## Release notes\n\nHello",
    );
  });

  test("does not mutate fenced code lines", () => {
    const src = "```\n## not a heading ##\n```";
    expect(normalizeMarkdownFeedArtifacts(src)).toBe(src);
  });
});
