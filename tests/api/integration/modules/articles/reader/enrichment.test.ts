import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import {
  resolveEnhancementContent,
  summarizeContent,
  translateContent,
} from "@modules/articles/reader/enrichment";
import { feedDetail } from "./fixtures";

/** The typed failure of an Effect, as `{ _tag, code, message }`. */
async function failureOf<A, E extends { _tag: string; code?: string; message: string }>(
  effect: Effect.Effect<A, E>,
) {
  const error = await Effect.runPromise(Effect.flip(effect));
  return { tag: error._tag, code: error.code, message: error.message };
}

describe("articles.enrichment", () => {
  test("summarizeContent returns first sentence chunk", async () => {
    expect(await Effect.runPromise(summarizeContent("One. Two. Three. Four.", undefined))).toBe(
      "One. Two. Three.",
    );
  });

  test("summarizeContent tags a non-original language and truncates sentence-less text", async () => {
    expect(await Effect.runPromise(summarizeContent("Short text.", "fr"))).toBe("[fr] Short text.");
    expect(await Effect.runPromise(summarizeContent("x".repeat(400), "original"))).toBe(
      "x".repeat(400),
    );
  });

  test("summarizeContent rejects blank content with its stable code", async () => {
    expect(await failureOf(summarizeContent("   ", undefined))).toEqual({
      tag: "BadRequest",
      code: "SUMMARY_CONTENT_MISSING",
      message: "No content available to summarize",
    });
  });

  test("translateContent keeps original when requested", async () => {
    expect(await Effect.runPromise(translateContent("Hello world", "original"))).toBe(
      "Hello world",
    );
    expect(await Effect.runPromise(translateContent("Hello world", "ORIGINAL"))).toBe(
      "Hello world",
    );
  });

  test("translateContent marks the target language", async () => {
    expect(await Effect.runPromise(translateContent("Hello", "de"))).toBe("[translated:de] Hello");
  });

  test("translateContent rejects blank content and a blank target with distinct codes", async () => {
    expect(await failureOf(translateContent(" ", "de"))).toMatchObject({
      tag: "BadRequest",
      code: "TRANSLATION_CONTENT_MISSING",
    });
    expect(await failureOf(translateContent("Hello", "  "))).toMatchObject({
      tag: "BadRequest",
      code: "TARGET_LANGUAGE_REQUIRED",
      message: "target_language is required",
    });
  });

  test("resolveEnhancementContent prefers explicit request content, trimmed", async () => {
    const article = feedDetail({ contentText: "From the article." });
    expect(await Effect.runPromise(resolveEnhancementContent("  mine  ", article))).toBe("mine");
  });

  test("resolveEnhancementContent falls back to the selected reader body, then the summary", async () => {
    const withBody = feedDetail({
      contentHtml: "<p>Body text that is long enough to count as the article body.</p>",
      contentText: "Body text that is long enough to count as the article body.",
    });
    expect(await Effect.runPromise(resolveEnhancementContent(undefined, withBody))).toBe(
      "Body text that is long enough to count as the article body.",
    );

    const summaryOnly = feedDetail({ summary: "Just a summary" });
    expect(await Effect.runPromise(resolveEnhancementContent("   ", summaryOnly))).toBe(
      "Just a summary",
    );
  });

  test("resolveEnhancementContent fails when the article has nothing to process", async () => {
    expect(await failureOf(resolveEnhancementContent(undefined, feedDetail({})))).toEqual({
      tag: "BadRequest",
      code: "ARTICLE_CONTENT_MISSING",
      message: "No content available to process",
    });
  });
});
