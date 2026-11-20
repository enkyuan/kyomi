import { Effect } from "effect";
import { BadRequest } from "@shared/effect/errors";
import type { ArticleDetailDto } from "../types";

function firstSentences(input: string, maxSentences: number): string {
  const chunks = input
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return chunks.slice(0, maxSentences).join(" ");
}

/** Text the enrichment endpoints operate on: the request's own content, else the article's body. */
export function resolveEnhancementContent(
  requestContent: string | undefined,
  article: ArticleDetailDto,
): Effect.Effect<string, BadRequest> {
  const explicit = requestContent?.trim();
  if (explicit) {
    return Effect.succeed(explicit);
  }
  const primary = article.reader.selected;
  const fallback = (
    primary.contentText ??
    primary.contentMarkdown ??
    primary.contentHtml ??
    article.summary ??
    ""
  ).trim();
  return fallback
    ? Effect.succeed(fallback)
    : Effect.fail(
        new BadRequest({
          message: "No content available to process",
          code: "ARTICLE_CONTENT_MISSING",
        }),
      );
}

export function summarizeContent(
  content: string,
  languageKey: string | undefined,
): Effect.Effect<string, BadRequest> {
  const text = content.trim();
  if (!text) {
    return Effect.fail(
      new BadRequest({
        message: "No content available to summarize",
        code: "SUMMARY_CONTENT_MISSING",
      }),
    );
  }
  const summary = firstSentences(text, 3) || text.slice(0, 300);
  return Effect.succeed(
    !languageKey || languageKey === "original" ? summary : `[${languageKey}] ${summary}`,
  );
}
