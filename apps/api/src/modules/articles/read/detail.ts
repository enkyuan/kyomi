import type { db } from "@adapters/db/client";
import { feedItemUserState, feedItems, feedSubscriptions, feeds } from "@kyomi/db";
import { and, eq, sql } from "drizzle-orm";
import { AppError } from "@shared/errors/app";
import { decodeNullableText, decodeText } from "@shared/text/entities";
import { getClipDetailForUser } from "../write/clips/detail";
import {
  buildArticleReaderDto,
  buildExtractedReaderViewFromDb,
  buildStoredReaderContent,
} from "../reader/content";
import { articleIsReadSql } from "./sql";
import type { ArticleDetailDto } from "../types";
import type { ExtractedContentStatus } from "../reader/content";

type DB = typeof db;

async function getFeedArticleDetailForUser(
  database: DB,
  userId: string,
  articleId: string,
): Promise<ArticleDetailDto | null> {
  const feedSubscriptionsJoin = and(
    eq(feedItems.feedId, feedSubscriptions.feedId),
    eq(feedSubscriptions.userId, userId),
  );
  const userStateJoin = and(
    eq(feedItemUserState.feedItemId, feedItems.id),
    eq(feedItemUserState.userId, userId),
  );

  const rows = await database
    .select({
      id: feedItems.id,
      title: feedItems.title,
      link: feedItems.link,
      summary: feedItems.summary,
      content: feedItems.content,
      contentHtml: feedItems.contentHtml,
      contentText: feedItems.contentText,
      contentMarkdown: feedItems.contentMarkdown,
      contentStatus: feedItems.contentStatus,
      contentSource: feedItems.contentSource,
      extractionErrorCode: feedItems.extractionErrorCode,
      extractionErrorMessage: feedItems.extractionErrorMessage,
      extractedContentHtml: feedItems.extractedContentHtml,
      extractedContentText: feedItems.extractedContentText,
      extractedContentStatus: feedItems.extractedContentStatus,
      extractedContentError: feedItems.extractedContentError,
      extractedContentUpdatedAt: feedItems.extractedContentUpdatedAt,
      publishedAt: feedItems.publishedAt,
      feedId: feedItems.feedId,
      feedUrl: feeds.url,
      feedSiteUrl: feeds.link,
      feedTitle: feeds.title,
      feedFaviconUrl: feeds.faviconUrl,
      isRead: articleIsReadSql,
      isSaved: sql<boolean>`COALESCE(${feedItemUserState.isSaved}, false)`,
    })
    .from(feedItems)
    .leftJoin(feedSubscriptions, feedSubscriptionsJoin)
    .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
    .leftJoin(feedItemUserState, userStateJoin)
    .where(eq(feedItems.id, articleId))
    .limit(1);

  const r = rows[0];
  if (!r) {
    return null;
  }

  const extractedStatus = (r.extractedContentStatus as ExtractedContentStatus) ?? "pending";
  const readerOriginal = buildStoredReaderContent({
    articleType: "feed",
    title: decodeText(r.title),
    summary: decodeNullableText(r.summary),
    contentBaseUrl: r.link,
    legacyContent: decodeNullableText(r.content),
    contentHtml: r.contentHtml,
    contentText: decodeNullableText(r.contentText),
    contentMarkdown: r.contentMarkdown,
    contentStatus: (r.contentStatus as ArticleDetailDto["contentStatus"]) ?? "pending",
    contentSource: (r.contentSource as ArticleDetailDto["contentSource"]) ?? "link_only",
    extractionErrorCode: r.extractionErrorCode,
    extractionErrorMessage: r.extractionErrorMessage,
  });
  const readerExtracted = buildExtractedReaderViewFromDb({
    articleType: "feed",
    title: decodeText(r.title),
    summary: decodeNullableText(r.summary),
    contentBaseUrl: r.link,
    extractedContentHtml: r.extractedContentHtml,
    extractedContentText: r.extractedContentText
      ? decodeNullableText(r.extractedContentText)
      : null,
    extractedContentStatus: extractedStatus,
  });
  const reader = buildArticleReaderDto({
    readerOriginal,
    readerExtracted,
    extractedContentStatus: extractedStatus,
    extractedContentError: r.extractedContentError,
    extractedContentUpdatedAt: r.extractedContentUpdatedAt?.toISOString() ?? null,
  });

  return {
    id: r.id,
    title: decodeText(r.title),
    link: r.link,
    summary: decodeNullableText(r.summary),
    contentHtml: r.contentHtml,
    contentText: decodeNullableText(r.contentText),
    contentMarkdown: r.contentMarkdown,
    contentStatus: (r.contentStatus as ArticleDetailDto["contentStatus"]) ?? "pending",
    contentSource: (r.contentSource as ArticleDetailDto["contentSource"]) ?? "link_only",
    extractionErrorCode: r.extractionErrorCode,
    extractionErrorMessage: r.extractionErrorMessage,
    publishedAt: r.publishedAt.toISOString(),
    feedId: r.feedId,
    feedUrl: r.feedUrl,
    feedSiteUrl: r.feedSiteUrl,
    feedTitle: decodeText(r.feedTitle),
    feedFaviconUrl: r.feedFaviconUrl,
    isRead: r.isRead,
    isSaved: Boolean(r.isSaved),
    articleType: "feed",
    reader,
  };
}

export async function getArticleDetailForUser(
  database: DB,
  userId: string,
  articleId: string,
): Promise<ArticleDetailDto> {
  const [feed, clip] = await Promise.all([
    getFeedArticleDetailForUser(database, userId, articleId),
    getClipDetailForUser(database, userId, articleId),
  ]);
  if (feed) {
    return feed;
  }
  if (clip) {
    return clip;
  }
  throw new AppError("Article not found", { status: 404, code: "ARTICLE_NOT_FOUND" });
}
