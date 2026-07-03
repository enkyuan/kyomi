import { AppError } from "@shared/errors/app";
import type { ArticleDetailDto } from "../types";
import { extractArticleContentFromUrl } from "./extraction";

function firstSentences(input: string, maxSentences: number): string {
  const chunks = input
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return chunks.slice(0, maxSentences).join(" ");
}

export function resolveEnhancementContent(
  requestContent: string | undefined,
  article: ArticleDetailDto,
) {
  const explicit = requestContent?.trim();
  if (explicit) {
    return explicit;
  }
  const primary = article.reader.selected;
  const fallback = (
    primary.contentText ??
    primary.contentMarkdown ??
    primary.contentHtml ??
    article.summary ??
    ""
  ).trim();
  if (!fallback) {
    throw new AppError("No content available to process", {
      status: 400,
      code: "ARTICLE_CONTENT_MISSING",
    });
  }
  return fallback;
}

export async function extractFullTextFromUrl(url: string): Promise<string> {
  const extracted = await extractArticleContentFromUrl(url);
  if (!extracted.ok) {
    throw new AppError(extracted.errorMessage, {
      status: 400,
      code: extracted.errorCode,
    });
  }

  if (!extracted.content.contentHtml) {
    throw new AppError("No readable HTML content was extracted.", {
      status: 400,
      code: "EXTRACTION_EMPTY",
    });
  }

  return extracted.content.contentHtml;
}
export function summarizeContent(content: string, languageKey: string | undefined): string {
  const text = content.trim();
  if (!text) {
    throw new AppError("No content available to summarize", {
      status: 400,
      code: "SUMMARY_CONTENT_MISSING",
    });
  }
  const summary = firstSentences(text, 3) || text.slice(0, 300);
  if (!languageKey || languageKey === "original") {
    return summary;
  }
  return `[${languageKey}] ${summary}`;
}

export function translateContent(content: string, targetLanguage: string): string {
  const text = content.trim();
  if (!text) {
    throw new AppError("No content available to translate", {
      status: 400,
      code: "TRANSLATION_CONTENT_MISSING",
    });
  }
  const target = targetLanguage.trim();
  if (!target) {
    throw new AppError("target_language is required", {
      status: 400,
      code: "TARGET_LANGUAGE_REQUIRED",
    });
  }
  if (target.toLowerCase() === "original") {
    return text;
  }
  return `[translated:${target}] ${text}`;
}
