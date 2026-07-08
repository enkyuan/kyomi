import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { htmlToText, sanitizeArticleHtml } from "../content";
import type { ArticleExtractionCandidate } from "../content";
import { fetchArticleDocument } from "./fetch";

type ArticleExtractionResult =
  | { ok: true; content: ArticleExtractionCandidate }
  | { ok: false; errorCode: string; errorMessage: string };

function wordCount(input: string): number {
  return input.split(/\s+/).filter(Boolean).length;
}

function paragraphCount(input: string): number {
  return input
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function looksLikeNonArticlePage(url: URL): boolean {
  const path = url.pathname.toLowerCase();
  return ["/search", "/login", "/signin", "/archive", "/archives", "/tag/", "/tags/"].some(
    (pattern) => path === pattern || path.startsWith(pattern),
  );
}

export function extractArticleContentFromHtml(input: {
  body: string;
  finalUrl: string;
}): ArticleExtractionResult {
  let finalUrl: URL;
  try {
    finalUrl = new URL(input.finalUrl);
  } catch {
    return {
      ok: false,
      errorCode: "BLOCKED_URL",
      errorMessage: "Invalid or unsafe URL provided.",
    };
  }

  if (looksLikeNonArticlePage(finalUrl)) {
    return {
      ok: false,
      errorCode: "NO_READABLE_CONTENT",
      errorMessage: "This source is not a readable article page.",
    };
  }

  let article: ReturnType<Readability["parse"]> | null;
  try {
    const htmlView = parseHTML(input.body);
    const doc = htmlView.document;
    try {
      Object.defineProperty(doc, "URL", { value: finalUrl.href, configurable: true });
    } catch {
      /* ignore if runtime does not allow redefining URL */
    }
    const reader = new Readability(doc);
    article = reader.parse();
  } catch (error) {
    return {
      ok: false,
      errorCode: "PARSING_FAILED",
      errorMessage:
        error instanceof Error
          ? `Could not parse article HTML: ${error.message}`
          : "Could not parse article HTML.",
    };
  }

  if (!article?.content) {
    return {
      ok: false,
      errorCode: "NO_READABLE_CONTENT",
      errorMessage: "No readable article body was found.",
    };
  }

  const contentHtml = sanitizeArticleHtml(article.content, {
    baseUrl: finalUrl.href,
    title: article.title?.trim() || null,
    byline: article.byline?.trim() || null,
    excerpt: article.excerpt?.trim() || null,
  });
  const contentText = htmlToText(contentHtml);

  if (wordCount(contentText) < 60 || paragraphCount(contentText) < 2) {
    return {
      ok: false,
      errorCode: "NO_READABLE_CONTENT",
      errorMessage: "This source did not expose enough readable article text.",
    };
  }

  return {
    ok: true,
    content: {
      title: article.title?.trim() || null,
      byline: article.byline?.trim() || null,
      excerpt: article.excerpt?.trim() || null,
      contentHtml: contentHtml || null,
      contentText: contentText || null,
      siteName: article.siteName?.trim() || null,
      language: article.lang?.trim() || null,
      publishedTime: null,
    },
  };
}

export async function extractArticleContentFromUrl(url: string): Promise<ArticleExtractionResult> {
  const fetched = await fetchArticleDocument(url);
  if (!fetched.ok) {
    return fetched;
  }

  return extractArticleContentFromHtml({
    body: fetched.body,
    finalUrl: fetched.finalUrl,
  });
}
