import type { db } from "@adapters/db/client";
import { articleClips, articleReports, feedItems, feedSubscriptions, feeds } from "@kyomi/db";
import { and, eq } from "drizzle-orm";
import { AppError } from "@shared/errors/app";
import type { BrokenArticleReportBody } from "../types";

type DB = typeof db;

function normalizeDetails(details: string | null | undefined): string | null {
  const trimmed = details?.trim();
  return trimmed ? trimmed.slice(0, 4000) : null;
}

export async function createBrokenArticleReport(
  database: DB,
  userId: string,
  articleId: string,
  body: BrokenArticleReportBody,
): Promise<void> {
  const [clip] = await database
    .select({
      id: articleClips.id,
      title: articleClips.title,
      url: articleClips.url,
    })
    .from(articleClips)
    .where(and(eq(articleClips.id, articleId), eq(articleClips.userId, userId)))
    .limit(1);

  if (clip) {
    await database.insert(articleReports).values({
      id: crypto.randomUUID(),
      userId,
      articleId,
      articleType: "clip",
      clipId: clip.id,
      reason: body.reason ?? "broken_article",
      details: normalizeDetails(body.details),
      articleTitle: clip.title,
      articleUrl: clip.url,
      feedTitle: null,
      feedUrl: null,
    });
    return;
  }

  const [feedArticle] = await database
    .select({
      id: feedItems.id,
      title: feedItems.title,
      url: feedItems.link,
      feedTitle: feeds.title,
      feedUrl: feeds.url,
    })
    .from(feedItems)
    .innerJoin(feeds, eq(feedItems.feedId, feeds.id))
    .innerJoin(
      feedSubscriptions,
      and(eq(feedSubscriptions.feedId, feedItems.feedId), eq(feedSubscriptions.userId, userId)),
    )
    .where(eq(feedItems.id, articleId))
    .limit(1);

  if (!feedArticle) {
    throw new AppError("Article not found", { status: 404, code: "ARTICLE_NOT_FOUND" });
  }

  await database.insert(articleReports).values({
    id: crypto.randomUUID(),
    userId,
    articleId,
    articleType: "feed",
    feedItemId: feedArticle.id,
    reason: body.reason ?? "broken_article",
    details: normalizeDetails(body.details),
    articleTitle: feedArticle.title,
    articleUrl: feedArticle.url,
    feedTitle: feedArticle.feedTitle,
    feedUrl: feedArticle.feedUrl,
  });
}
