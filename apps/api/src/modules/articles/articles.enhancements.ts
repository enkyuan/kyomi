import { AppError } from "@shared/errors/app-error";
import type { ArticleDetailDto } from "./articles.types";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;

/**
 * Patterns that match private/loopback hostnames and IP ranges.
 * Used to block outbound server-side fetches to internal network targets.
 */
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^::$/,
  /^::ffff:/i,
  /^fc00:/i,
  /^fe80:/i,
  /^localhost$/i,
];

function isSafeUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }
  // url.hostname already strips brackets for IPv6 addresses (e.g. [::1] -> ::1)
  return !PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(url.hostname));
}

function stripHtmlTags(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

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
  const fallback = (article.content ?? article.summary ?? "").trim();
  if (!fallback) {
    throw new AppError("No content available to process", {
      status: 400,
      code: "ARTICLE_CONTENT_MISSING",
    });
  }
  return fallback;
}

export async function extractFullTextFromUrl(url: string): Promise<string> {
  if (!isSafeUrl(url)) {
    throw new AppError("Invalid or blocked URL", {
      status: 400,
      code: "EXTRACTION_URL_BLOCKED",
    });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "CronosArticleExtractor/1.0" },
    });
    if (!res.ok) {
      throw new AppError(`Extraction failed (HTTP ${res.status})`, {
        status: 400,
        code: "EXTRACTION_FAILED",
      });
    }

    const body = await res.text();
    if (body.length > MAX_HTML_BYTES) {
      throw new AppError("Article response too large", {
        status: 400,
        code: "EXTRACTION_TOO_LARGE",
      });
    }

    const text = stripHtmlTags(body);
    if (!text) {
      throw new AppError("No extractable content found", {
        status: 400,
        code: "EXTRACTION_EMPTY",
      });
    }
    return text;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Failed to extract article content", {
      status: 400,
      code: "EXTRACTION_FAILED",
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }
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
