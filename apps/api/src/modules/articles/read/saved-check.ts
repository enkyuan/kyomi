import type { db } from "@adapters/db/client";
import { articleClips, feedItems, feedItemUserState, feedSubscriptions } from "@cronos/db";
import { AppError } from "@shared/errors/app-error";
import { and, desc, eq } from "drizzle-orm";
import type { ArticleSavedCheckDto } from "../types";

type DB = typeof db;

export async function checkSavedArticleForUser(
  database: DB,
  userId: string,
  rawUrl: string,
): Promise<ArticleSavedCheckDto> {
  const url = rawUrl.trim();
  if (!url) {
    throw new AppError("url is required", { status: 400, code: "ARTICLE_URL_REQUIRED" });
  }

  const [clip] = await database
    .select({
      id: articleClips.id,
      title: articleClips.title,
      url: articleClips.url,
    })
    .from(articleClips)
    .where(
      and(
        eq(articleClips.userId, userId),
        eq(articleClips.url, url),
        eq(articleClips.isSaved, true),
      ),
    )
    .orderBy(desc(articleClips.updatedAt), desc(articleClips.id))
    .limit(1);

  if (clip) {
    return {
      is_saved: true,
      article: {
        id: clip.id,
        title: clip.title,
        url: clip.url,
        articleType: "clip",
      },
    };
  }

  const [feedItem] = await database
    .select({
      id: feedItems.id,
      title: feedItems.title,
      url: feedItems.link,
    })
    .from(feedItems)
    .innerJoin(
      feedSubscriptions,
      and(eq(feedSubscriptions.feedId, feedItems.feedId), eq(feedSubscriptions.userId, userId)),
    )
    .innerJoin(
      feedItemUserState,
      and(eq(feedItemUserState.feedItemId, feedItems.id), eq(feedItemUserState.userId, userId)),
    )
    .where(and(eq(feedItems.link, url), eq(feedItemUserState.isSaved, true)))
    .orderBy(desc(feedItems.publishedAt), desc(feedItems.id))
    .limit(1);

  if (feedItem) {
    return {
      is_saved: true,
      article: {
        id: feedItem.id,
        title: feedItem.title,
        url: feedItem.url,
        articleType: "feed",
      },
    };
  }

  return {
    is_saved: false,
    article: null,
  };
}
