import { Readability } from "@mozilla/readability";
import { Effect } from "effect";
import { parseHTML } from "linkedom";
import type { HostRateLimiter } from "@kyomi/ingest";
import {
  isTreeWithinStructureBudget,
  isWithinStructureBudget,
} from "@kyomi/ingest/document/structure-budget";
import { processIngestedArticleHtml } from "../content";
import type { ArticleExtractionCandidate } from "../content";
import { blockedUrl, ExtractionFailed } from "./errors";
import { fetchArticleDocument, withHostRateLimit } from "./fetch";

type ArticleExtraction = {
  content: ArticleExtractionCandidate;
  finalUrl: string;
  sanitizerVersion: string;
  /** Readability output before compiling; stored for recompiles and never served. */
  rawHtml: string;
};

const noReadableContent = (errorMessage: string) =>
  new ExtractionFailed({ errorCode: "NO_READABLE_CONTENT", errorMessage });

function wordCount(input: string): number {
  return input.split(/\s+/).filter(Boolean).length;
}

function paragraphCount(input: string): number {
  const blankSeparated = input
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean).length;

  if (blankSeparated > 1) {
    return blankSeparated;
  }

  return input
    .split(/\n+/)
    .map((part) => part.trim())
    .filter((part) => part && (wordCount(part) >= 8 || /[.!?](?:\s|$)/.test(part))).length;
}

function normalizeReadabilityPreformattedProse(html: string): string {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);

  for (const pre of Array.from(document.querySelectorAll("pre"))) {
    if (pre.querySelector("code")) {
      continue;
    }

    const paragraphs = (pre.textContent ?? "")
      .split(/\n\s*\n+/)
      .map((part) => part.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean);
    const proseParagraphCount = paragraphs.filter(
      (part) => wordCount(part) >= 8 && /[.!?](?:[\"')\]]?)(?:\s|$)/.test(part),
    ).length;

    if (paragraphs.length < 2 || wordCount(paragraphs.join(" ")) < 60 || proseParagraphCount < 2) {
      continue;
    }

    pre.replaceWith(
      ...paragraphs.map((text) => {
        const paragraph = document.createElement("p");
        paragraph.textContent = text;
        return paragraph;
      }),
    );
  }

  return document.body.innerHTML;
}

/**
 * Compiles Readability output the same way for fresh extractions and for recompiling a stored
 * raw body.
 */
export function compileExtractedHtml(
  rawHtml: string,
  options: {
    baseUrl: string | null;
    title?: string | null;
    byline?: string | null;
    excerpt?: string | null;
  },
) {
  return processIngestedArticleHtml(normalizeReadabilityPreformattedProse(rawHtml), options);
}

function looksLikeNonArticlePage(url: URL): boolean {
  const path = url.pathname.toLowerCase();
  return ["/search", "/login", "/signin", "/archive", "/archives", "/tag/", "/tags/"].some(
    (pattern) => path === pattern || path.startsWith(pattern),
  );
}

const parsingFailed = (cause: unknown) =>
  new ExtractionFailed({
    errorCode: "PARSING_FAILED",
    errorMessage:
      cause instanceof Error
        ? `Could not parse article HTML: ${cause.message}`
        : "Could not parse article HTML.",
    cause,
  });

const tooComplex = () => noReadableContent("This source is too complex to read as an article.");

/**
 * Parse `body` as the page at `finalUrl` and run Readability over it. A page past the structure
 * budget (the one article bodies are held to) fails as having no readable article, before
 * Readability reads it: its cost grows with the cube of the nesting and the square of the element
 * count, and its own `maxElemsToParse` counts nothing on linkedom, so a few kilobytes of nested
 * `<div>` or a few megabytes of links would hold the thread for tens of seconds. The source is
 * measured first so a page that plainly is too deep is not parsed, then the tree that came out.
 */
const readArticle = Effect.fnUntraced(function* (body: string, finalUrl: URL) {
  if (!isWithinStructureBudget(body)) {
    return yield* tooComplex();
  }
  const doc = yield* Effect.try({ try: () => parseHTML(body).document, catch: parsingFailed });
  if (!isTreeWithinStructureBudget(doc)) {
    return yield* tooComplex();
  }
  return yield* Effect.try({
    try: () => {
      try {
        Object.defineProperty(doc, "URL", { value: finalUrl.href, configurable: true });
      } catch {
        /* ignore if runtime does not allow redefining URL */
      }
      return new Readability(doc).parse();
    },
    catch: parsingFailed,
  });
});

/** Run Readability over fetched HTML. Pure CPU work; a page with no article fails typed. */
export const extractArticleContentFromHtml = Effect.fn("extraction.readability")(function* (input: {
  body: string;
  finalUrl: string;
}) {
  const finalUrl = yield* Effect.try({ try: () => new URL(input.finalUrl), catch: blockedUrl });
  if (looksLikeNonArticlePage(finalUrl)) {
    return yield* noReadableContent("This source is not a readable article page.");
  }

  const article = yield* readArticle(input.body, finalUrl);
  if (!article?.content) {
    return yield* noReadableContent("No readable article body was found.");
  }

  const title = article.title?.trim() || null;
  const byline = article.byline?.trim() || null;
  const excerpt = article.excerpt?.trim() || null;
  const processed = compileExtractedHtml(article.content, {
    baseUrl: finalUrl.href,
    title,
    byline,
    excerpt,
  });
  if (wordCount(processed.text) < 60 || paragraphCount(processed.text) < 2) {
    return yield* noReadableContent("This source did not expose enough readable article text.");
  }

  return {
    finalUrl: finalUrl.href,
    sanitizerVersion: processed.sanitizerVersion,
    rawHtml: article.content,
    content: {
      title,
      byline,
      excerpt,
      contentHtml: processed.html || null,
      contentText: processed.text || null,
      siteName: article.siteName?.trim() || null,
      language: article.lang?.trim() || null,
      publishedTime: null,
    },
  } satisfies ArticleExtraction;
});

/** Fetch an article page (under the host's rate limit, when given one) and extract its body. */
export const extractArticleContentFromUrl = Effect.fn("extraction.fromUrl")(function* (
  url: string,
  options?: { hostRateLimiter?: HostRateLimiter },
) {
  const fetched = yield* withHostRateLimit(
    options?.hostRateLimiter,
    url,
    fetchArticleDocument(url),
  );
  return yield* extractArticleContentFromHtml({ body: fetched.body, finalUrl: fetched.finalUrl });
});
