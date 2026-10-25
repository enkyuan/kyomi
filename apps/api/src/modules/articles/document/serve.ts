import type { db } from "@adapters/db/client";
import { articleClips, feedItems } from "@kyomi/db";
import { eq } from "drizzle-orm";
import { getArticleDetailForUser } from "@modules/articles/read/detail";
import type { ArticleReaderContentDto } from "@modules/articles/reader/content";
import type { ArticleDetailDto } from "@modules/articles/types";

type DB = typeof db;

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

async function readStoredDocuments(
  database: DB,
  article: ArticleDetailDto,
): Promise<StoredArticleDocuments | null> {
  const table = article.articleType === "feed" ? feedItems : articleClips;
  const [row] = await database
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
    .limit(1);
  if (!row) {
    return null;
  }
  return {
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
}

/**
 * Article detail with capability negotiation. `maxVersion` is what the client declared (0 when it
 * did not opt in) and `enabled` is the `FEATURE_READER_DOCUMENT` flag; either one off returns
 * the plain detail without touching the document columns.
 */
export async function getArticleDetailWithDocumentForUser(
  database: DB,
  userId: string,
  articleId: string,
  options: { enabled: boolean; maxVersion: number },
): Promise<ArticleDetailDto> {
  const article = await getArticleDetailForUser(database, userId, articleId);
  if (!options.enabled || options.maxVersion <= 0) {
    return article;
  }
  const stored = await readStoredDocuments(database, article);
  return stored ? applyStoredDocuments(article, stored, options.maxVersion) : article;
}
