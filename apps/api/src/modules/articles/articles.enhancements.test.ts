import { describe, expect, test } from "bun:test";
import { summarizeContent, translateContent } from "./articles.enhancements";

describe("articles.enhancements", () => {
  test("summarizeContent returns first sentence chunk", () => {
    const summary = summarizeContent("One. Two. Three. Four.", undefined);
    expect(summary).toBe("One. Two. Three.");
  });

  test("translateContent keeps original when requested", () => {
    const out = translateContent("Hello world", "original");
    expect(out).toBe("Hello world");
  });
});
