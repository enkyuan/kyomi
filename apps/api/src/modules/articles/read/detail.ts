import { Effect } from "effect";
import {
  articleReadingState,
  feedItemUserState,
  feedItems,
  feedSubscriptions,
  feeds,
} from "@kyomi/db";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { Db, type Database } from "@adapters/db/service";
import { AppConfig } from "@config/env/service";
import { decodeNullableText, decodeText } from "@shared/text/entities";
import {
  feedReadingStateJoin,
  readingPositionColumns,
  toReadingPositionDto,
  toReadingProgressDto,
  type ReadingPositionColumnsRow,
} from "../progress/read";
import { getClipDetailForUser } from "../write/clips/detail";
import {
  buildArticleReaderDto,
  buildExtractedReaderViewFromDb,
  buildStoredReaderContent,
  normalizeMarkdownFeedArtifacts,
} from "../reader/content";
import { articleNotFound } from "../errors";
import { articleIsReadSql, subscriptionJoin, userStateJoin } from "./sql";
import { categoryLabelsFor } from "./labels";
import type { ArticleDetailDto } from "../types";
import type { ExtractedContentStatus } from "../reader/content";

type FeedArticleDetailRawRow = ReadingPositionColumnsRow & {
  id: string;
  title: string;
  link: string;
  summary: string | null;
  imageUrl: string | null;
  content: string | null;
  contentHtml: string | null;
  contentSanitizerVersion: string | null;
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
  lastViewedAt: Date | null;
  categories: string[];
};

export function toFeedArticleDetailDto(row: FeedArticleDetailRawRow): ArticleDetailDto {
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
    contentSanitizerVersion: row.contentSanitizerVersion,
    contentText: decodeNullableText(row.contentText),
    contentMarkdown:
      row.contentMarkdown === null ? null : normalizeMarkdownFeedArtifacts(row.contentMarkdown),
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
    imageUrl: row.imageUrl,
    contentHtml: row.contentHtml,
    contentText: decodeNullableText(row.contentText),
    contentMarkdown:
      row.contentMarkdown === null ? null : normalizeMarkdownFeedArtifacts(row.contentMarkdown),
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
    lastViewedAt: row.lastViewedAt?.toISOString() ?? null,
    articleType: "feed",
    categories: row.categories.map(decodeText),
    readingProgress: toReadingProgressDto(row),
    readingPosition: toReadingPositionDto(row),
    reader,
  };
}

async function getFeedArticleDetailForUser(
  database: Database,
  userId: string,
  articleId: string,
  categories: SQL<string[]>,
): Promise<ArticleDetailDto | null> {
  const rows = await database
    .select({
      id: feedItems.id,
      title: feedItems.title,
      link: feedItems.link,
      summary: feedItems.summary,
      imageUrl: feedItems.imageUrl,
      content: feedItems.content,
      contentHtml: feedItems.contentHtml,
      contentSanitizerVersion: feedItems.contentSanitizerVersion,
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
      lastViewedAt: feedItemUserState.lastViewedAt,
      categories,
      ...readingPositionColumns,
    })
    .from(feedItems)
    .leftJoin(feedSubscriptions, subscriptionJoin(userId))
    .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
    .leftJoin(feedItemUserState, userStateJoin(userId))
    .leftJoin(articleReadingState, feedReadingStateJoin(userId))
    .where(eq(feedItems.id, articleId))
    .limit(1);

  const r = rows[0];
  if (!r) {
    return null;
  }

  return toFeedArticleDetailDto(r);
}

/** The user's feed item or clip with this id; fails with `ARTICLE_NOT_FOUND` when neither exists. */
export const getArticleDetail = Effect.fn("articles.detail")(function* (
  userId: string,
  articleId: string,
) {
  const db = yield* Db;
  const categories = categoryLabelsFor(yield* AppConfig);
  const [feed, clip] = yield* Effect.all(
    [
      db.use("articles.detail.feed", (client) =>
        getFeedArticleDetailForUser(client, userId, articleId, categories),
      ),
      db.use("articles.detail.clip", (client) => getClipDetailForUser(client, userId, articleId)),
    ],
    { concurrency: 2 },
  );
  const detail = feed ?? clip;
  if (!detail) {
    return yield* articleNotFound();
  }
  return detail;
});
