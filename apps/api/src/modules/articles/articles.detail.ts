import type { db } from "@adapters/db/client";
import { feedItemUserState, feedItems, feedSubscriptions, feeds } from "@cronos/db";
import { and, eq, sql } from "drizzle-orm";
import { AppError } from "@shared/errors/app-error";
import { decodeNullableText, decodeText } from "@shared/text/html-entities";
import { getClipDetailForUser } from "./articles.clips";
import { articleIsReadSql } from "./articles.sql-read";
import type { ArticleDetailDto } from "./articles.types";

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
      publishedAt: feedItems.publishedAt,
      feedId: feedItems.feedId,
      feedTitle: feeds.title,
      isRead: articleIsReadSql,
      isSaved: sql<boolean>`COALESCE(${feedItemUserState.isSaved}, false)`,
    })
    .from(feedItems)
    .innerJoin(feedSubscriptions, feedSubscriptionsJoin)
    .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
    .leftJoin(feedItemUserState, userStateJoin)
    .where(and(eq(feedItems.id, articleId), eq(feedSubscriptions.userId, userId)))
    .limit(1);

  const r = rows[0];
  if (!r) {
    return null;
  }

  return {
    id: r.id,
    title: decodeText(r.title),
    link: r.link,
    summary: decodeNullableText(r.summary),
    content: decodeNullableText(r.content),
    publishedAt: r.publishedAt.toISOString(),
    feedId: r.feedId,
    feedTitle: decodeText(r.feedTitle),
    isRead: r.isRead,
    isSaved: Boolean(r.isSaved),
    articleType: "feed",
  };
}

export async function getArticleDetailForUser(
  database: DB,
  userId: string,
  articleId: string,
): Promise<ArticleDetailDto> {
  const feed = await getFeedArticleDetailForUser(database, userId, articleId);
  if (feed) {
    return feed;
  }
  const clip = await getClipDetailForUser(database, userId, articleId);
  if (clip) {
    return clip;
  }
  throw new AppError("Article not found", { status: 404, code: "ARTICLE_NOT_FOUND" });
}
