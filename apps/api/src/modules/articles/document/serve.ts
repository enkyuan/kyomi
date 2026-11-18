import { Effect } from "effect";
import { articleClips, feedItems } from "@kyomi/db";
import { eq } from "drizzle-orm";
import { Db } from "@adapters/db/service";
import type { ArticleReaderContentDto } from "@modules/articles/reader/content";
import type { ArticleDetailDto } from "@modules/articles/types";

export type StoredBodyDocument = {
  document: Record<string, unknown> | null;
  documentVersion: number | null;
  compilerVersion: string | null;
};

export type StoredArticleDocuments = {
  original: StoredBodyDocument;
  extracted: StoredBodyDocument;
};

/**
 * Swaps an html, markdown, or text body for a `document` body when a stored document exists that
 * the client declared support for. Anything else (no document, newer than the client, fallback
 * body) is returned untouched, which is the whole fallback story: the HTML body keeps serving.
 */
export function toDocumentBody(
  content: ArticleReaderContentDto,
  stored: StoredBodyDocument,
  maxVersion: number,
): ArticleReaderContentDto {
  const { document, documentVersion, compilerVersion } = stored;
  if (
    content.bodyKind === "document" ||
    content.bodyKind === "fallback" ||
    !document ||
    documentVersion === null ||
    !compilerVersion ||
    documentVersion > maxVersion
  ) {
    return content;
  }
  return {
    contentStatus: content.contentStatus,
    contentSource: content.contentSource,
    contentBaseUrl: content.contentBaseUrl,
    title: content.title,
    byline: content.byline,
    excerpt: content.excerpt,
    siteName: content.siteName,
    language: content.language,
    publishedTime: content.publishedTime,
    notice: content.notice,
    extractionErrorCode: content.extractionErrorCode,
    extractionErrorMessage: content.extractionErrorMessage,
    shouldExtract: content.shouldExtract,
    bodyKind: "document",
    document,
    documentVersion,
    compilerVersion,
    fallbackBodyKind: content.bodyKind,
    contentHtml: content.contentHtml,
    contentMarkdown: content.contentMarkdown,
    contentText: content.contentText,
    fallbackSummary: null,
    fallbackReason: null,
  };
}

export function applyStoredDocuments(
  article: ArticleDetailDto,
  stored: StoredArticleDocuments,
  maxVersion: number,
): ArticleDetailDto {
  const original = toDocumentBody(article.reader.original.content, stored.original, maxVersion);
  const extractedContent = article.reader.extracted.content;
  const extracted = extractedContent
    ? toDocumentBody(extractedContent, stored.extracted, maxVersion)
    : null;
  const selected =
    article.reader.selected === extractedContent && extracted
      ? extracted
      : article.reader.selected === article.reader.original.content
        ? original
        : article.reader.selected;
  return {
    ...article,
    reader: {
      ...article.reader,
      selected,
      original: { ...article.reader.original, content: original },
      extracted: { ...article.reader.extracted, content: extracted },
    },
  };
}

const readStoredDocuments = Effect.fn("articles.document.readStored")(function* (
  article: ArticleDetailDto,
) {
  const db = yield* Db;
  const table = article.articleType === "feed" ? feedItems : articleClips;
  const [row] = yield* db.use("articles.document.read_stored", (client) =>
    client
      .select({
        document: table.contentDocument,
        documentVersion: table.contentDocumentVersion,
        compilerVersion: table.contentCompilerVersion,
        extractedDocument: table.extractedContentDocument,
        extractedDocumentVersion: table.extractedContentDocumentVersion,
        extractedCompilerVersion: table.extractedContentCompilerVersion,
      })
      .from(table)
      .where(eq(table.id, article.id))
      .limit(1),
  );
  if (!row) {
    return null;
  }
  const stored: StoredArticleDocuments = {
    original: {
      document: row.document as Record<string, unknown> | null,
      documentVersion: row.documentVersion,
      compilerVersion: row.compilerVersion,
    },
    extracted: {
      document: row.extractedDocument as Record<string, unknown> | null,
      documentVersion: row.extractedDocumentVersion,
      compilerVersion: row.extractedCompilerVersion,
    },
  };
  return stored;
});

export type DocumentNegotiation = { enabled: boolean; maxVersion: number };

/**
 * Applies capability negotiation to an article detail another operation produced (the detail
 * read, an extraction result), so every response that carries `reader` bodies agrees on which
 * body kind the client gets. `maxVersion` is what the client declared (0 when it did not opt in)
 * and `enabled` is the `FEATURE_READER_DOCUMENT` flag; either one off returns the article
 * untouched without reading the document columns.
 */
export const withNegotiatedDocuments = Effect.fn("articles.document.negotiate")(function* (
  article: ArticleDetailDto,
  options: DocumentNegotiation,
) {
  if (!options.enabled || options.maxVersion <= 0) {
    return article;
  }
  const stored = yield* readStoredDocuments(article);
  return stored ? applyStoredDocuments(article, stored, options.maxVersion) : article;
});
