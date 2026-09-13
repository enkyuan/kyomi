import { describe, expect, test } from "bun:test";
import { normalizeMarkdownFeedArtifacts } from "@modules/articles/reader/content";

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

  test("converts a blank-line-separated indented code block to a fence", () => {
    const src = "Intro\n\n    const value = 1;\n    return value;";
    expect(normalizeMarkdownFeedArtifacts(src)).toBe(
      "Intro\n\n```\nconst value = 1;\nreturn value;\n```",
    );
  });

  test("expands tabs and preserves relative indentation in indented code", () => {
    const src = "\n\tif (ready) {\n\t    run();\n\t}";
    expect(normalizeMarkdownFeedArtifacts(src)).toBe("\n```\nif (ready) {\n    run();\n}\n```");
  });

  test("does not convert list continuation lines", () => {
    const src = "- item\n\n      continuation";
    expect(normalizeMarkdownFeedArtifacts(src)).toBe(src);
  });

  test.each([
    ["backtick", "```"],
    ["tilde", "~~~"],
  ])("preserves every line inside an existing %s fence", (_, fence) => {
    const payloadFence = "`".repeat(3);
    const src = `${fence}\n\n    const value = 1;\n    ${payloadFence} payload\n  ${fence}`;
    expect(normalizeMarkdownFeedArtifacts(src)).toBe(src);
  });
});
