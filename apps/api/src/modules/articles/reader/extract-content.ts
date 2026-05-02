import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { fetchArticleDocument } from "./fetch-document";
import { htmlToText, sanitizeArticleHtml } from "./sanitize-content";
import type { ArticleExtractionCandidate } from "./content.types";

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

export async function extractArticleContentFromUrl(
  url: string,
): Promise<
  | { ok: true; content: ArticleExtractionCandidate }
  | { ok: false; errorCode: string; errorMessage: string }
> {
  const fetched = await fetchArticleDocument(url);
  if (!fetched.ok) {
    return fetched;
  }

  if (looksLikeNonArticlePage(new URL(fetched.finalUrl))) {
    return {
      ok: false,
      errorCode: "NO_READABLE_CONTENT",
      errorMessage: "This source is not a readable article page.",
    };
  }

  let article: ReturnType<Readability["parse"]> | null;
  try {
    const htmlView = parseHTML(fetched.body);
    const doc = htmlView.document;
    try {
      Object.defineProperty(doc, "URL", { value: fetched.finalUrl, configurable: true });
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

  const contentHtml = sanitizeArticleHtml(article.content, { baseUrl: fetched.finalUrl });
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
