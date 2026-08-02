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
import { categoryLabelsSql } from "./labels";
import type { ArticleDetailDto } from "../types";
import type { ExtractedContentStatus } from "../reader/content";

type DB = typeof db;

type FeedArticleDetailRawRow = {
  id: string;
  title: string;
  link: string;
  summary: string | null;
  content: string | null;
  contentHtml: string | null;
  contentText: string | null;
  contentMarkdown: string | null;
  contentStatus: ArticleDetailDto["contentStatus"] | string | null;
  contentSource: ArticleDetailDto["contentSource"] | string | null;
  extractionErrorCode: string | null;
  extractionErrorMessage: string | null;
  extractedContentHtml: string | null;
  extractedContentText: string | null;
  extractedContentStatus: ExtractedContentStatus | string | null;
  extractedContentError: string | null;
  extractedContentUpdatedAt: Date | null;
  extractedContentSanitizerVersion: string | null;
  publishedAt: Date;
  feedId: string;
  feedUrl: string | null;
  feedSiteUrl: string | null;
  feedTitle: string;
  feedFaviconUrl: string | null;
  isRead: boolean;
  isSaved: boolean | null;
  categories: string[];
};

function toFeedArticleDetailDto(row: FeedArticleDetailRawRow): ArticleDetailDto {
  const contentStatus = (row.contentStatus as ArticleDetailDto["contentStatus"]) ?? "pending";
  const contentSource = (row.contentSource as ArticleDetailDto["contentSource"]) ?? "link_only";
  const extractedStatus = (row.extractedContentStatus as ExtractedContentStatus) ?? "pending";
  const title = decodeText(row.title);
  const summary = decodeNullableText(row.summary);
  const readerOriginal = buildStoredReaderContent({
    articleType: "feed",
    title,
    summary,
    contentBaseUrl: row.link,
    legacyContent: decodeNullableText(row.content),
    contentHtml: row.contentHtml,
    contentText: decodeNullableText(row.contentText),
    contentMarkdown: row.contentMarkdown,
    contentStatus,
    contentSource,
    extractionErrorCode: row.extractionErrorCode,
    extractionErrorMessage: row.extractionErrorMessage,
  });
  const readerExtracted = buildExtractedReaderViewFromDb({
    articleType: "feed",
    title,
    summary,
    contentBaseUrl: row.link,
    extractedContentHtml: row.extractedContentHtml,
    extractedContentText: row.extractedContentText
      ? decodeNullableText(row.extractedContentText)
      : null,
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
    id: row.id,
    title,
    link: row.link,
    summary,
    contentHtml: row.contentHtml,
    contentText: decodeNullableText(row.contentText),
    contentMarkdown: row.contentMarkdown,
    contentStatus,
    contentSource,
    extractionErrorCode: row.extractionErrorCode,
    extractionErrorMessage: row.extractionErrorMessage,
    publishedAt: row.publishedAt.toISOString(),
    feedId: row.feedId,
    feedUrl: row.feedUrl,
    feedSiteUrl: row.feedSiteUrl,
    feedTitle: decodeText(row.feedTitle),
    feedFaviconUrl: row.feedFaviconUrl,
    isRead: row.isRead,
    isSaved: Boolean(row.isSaved),
    articleType: "feed",
    categories: row.categories.map(decodeText),
    reader,
  };
}

export const toFeedArticleDetailDtoForTest = toFeedArticleDetailDto;

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
      extractedContentSanitizerVersion: feedItems.extractedContentSanitizerVersion,
      publishedAt: feedItems.publishedAt,
      feedId: feedItems.feedId,
      feedUrl: feeds.url,
      feedSiteUrl: feeds.link,
      feedTitle: feeds.title,
      feedFaviconUrl: feeds.faviconUrl,
      isRead: articleIsReadSql,
      isSaved: sql<boolean>`COALESCE(${feedItemUserState.isSaved}, false)`,
      categories: categoryLabelsSql,
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

  return toFeedArticleDetailDto(r);
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
