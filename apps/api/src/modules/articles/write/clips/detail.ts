import type { db } from "@adapters/db/client";
import { articleClips } from "@kyomi/db";
import { and, eq } from "drizzle-orm";
import type { ArticleDetailDto, ArticleListItemDto } from "@modules/articles/types";
import {
  buildArticleReaderDto,
  buildExtractedReaderViewFromDb,
  buildStoredReaderContent,
  type ExtractedContentStatus,
} from "@modules/articles/reader/content";
import { CLIP_LIST_FEED_ID, CLIP_LIST_FEED_TITLE } from "./constants";

type DB = typeof db;

function clipToListItem(row: typeof articleClips.$inferSelect): ArticleListItemDto {
  return {
    id: row.id,
    title: row.title,
    link: row.url,
    summary: row.note,
    publishedAt: row.createdAt.toISOString(),
    feedId: CLIP_LIST_FEED_ID,
    feedUrl: row.url,
    feedSiteUrl: null,
    feedTitle: CLIP_LIST_FEED_TITLE,
    feedFaviconUrl: null,
    isRead: row.isRead,
    isSaved: row.isSaved,
    lastViewedAt: row.lastViewedAt?.toISOString() ?? null,
    articleType: "clip",
    categories: [],
  };
}

export function clipToDetail(row: typeof articleClips.$inferSelect): ArticleDetailDto {
  const base = clipToListItem(row);
  const extractedStatus = (row.extractedContentStatus as ExtractedContentStatus) ?? "pending";
  const readerOriginal = buildStoredReaderContent({
    articleType: "clip",
    title: row.title,
    summary: row.note,
    contentBaseUrl: row.url,
    legacyContent: row.content,
    contentHtml: row.contentHtml,
    contentText: row.contentText,
    contentMarkdown: row.contentMarkdown,
    contentStatus: row.contentStatus as ArticleDetailDto["contentStatus"] | null,
    contentSource: row.contentSource as ArticleDetailDto["contentSource"] | null,
    extractionErrorCode: row.extractionErrorCode,
    extractionErrorMessage: row.extractionErrorMessage,
  });
  const readerExtracted = buildExtractedReaderViewFromDb({
    articleType: "clip",
    title: row.title,
    summary: row.note,
    contentBaseUrl: row.url,
    extractedContentHtml: row.extractedContentHtml,
    extractedContentText: row.extractedContentText,
    extractedContentStatus: extractedStatus,
    extractedContentSanitizerVersion: row.extractedContentSanitizerVersion,
  });
  const reader = buildArticleReaderDto({
    readerOriginal,
    readerExtracted,
    extractedContentStatus: extractedStatus,
    extractedContentError: row.extractedContentError,
    extractedContentUpdatedAt: row.extractedContentUpdatedAt?.toISOString() ?? null,
  });
  return {
    ...base,
    imageUrl: null,
    contentHtml: row.contentHtml,
    contentText: row.contentText,
    contentMarkdown: row.contentMarkdown,
    contentStatus: (row.contentStatus as ArticleDetailDto["contentStatus"]) ?? "pending",
    contentSource: (row.contentSource as ArticleDetailDto["contentSource"]) ?? "link_only",
    extractionErrorCode: row.extractionErrorCode,
    extractionErrorMessage: row.extractionErrorMessage,
    reader,
  };
}

export async function getClipDetailForUser(
  database: DB,
  userId: string,
  clipId: string,
): Promise<ArticleDetailDto | null> {
  const rows = await database
    .select()
    .from(articleClips)
    .where(and(eq(articleClips.id, clipId), eq(articleClips.userId, userId)))
    .limit(1);
  const r = rows[0];
  return r ? clipToDetail(r) : null;
}
