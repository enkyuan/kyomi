import { Effect } from "effect";
import { compileBodyDocumentColumns } from "@modules/articles/document/stored";
import {
  ARTICLE_HTML_SANITIZER_VERSION,
  processIngestedArticleHtml,
} from "@modules/articles/reader/content";

export type ClientHtml = {
  contentHtml: string | null;
  contentRaw: string | null;
  contentSanitizerVersion: string | null;
  documentColumns: Effect.Success<ReturnType<typeof compileBodyDocumentColumns>>;
};

/**
 * Client-supplied HTML is untrusted: compile it like any ingested body and keep the original as
 * raw source, so the stored sanitizer version always describes compiler output. Empty input clears
 * the body, its raw source and its compiled document together.
 */
export const compileClientHtml = Effect.fn("articles.write.compile_html")(function* (
  value: string | null | undefined,
  article: { baseUrl: string; title: string },
) {
  const raw = value?.trim() ? value : null;
  if (!raw) {
    return {
      contentHtml: null,
      contentRaw: null,
      contentSanitizerVersion: null,
      documentColumns: yield* compileBodyDocumentColumns({
        raw: null,
        contentSource: null,
        baseUrl: null,
        title: null,
      }),
    } satisfies ClientHtml;
  }
  const compiled = processIngestedArticleHtml(raw, article);
  return {
    contentHtml: compiled.html || null,
    contentRaw: raw,
    contentSanitizerVersion: ARTICLE_HTML_SANITIZER_VERSION,
    documentColumns: yield* compileBodyDocumentColumns({
      raw,
      contentSource: "feed_html",
      baseUrl: article.baseUrl,
      title: article.title,
    }),
  } satisfies ClientHtml;
});
