import type { db } from "@adapters/db/client";
import { articleClips, feedItemUserState, feedItems, feedSubscriptions } from "@cronos/db";
import { and, eq } from "drizzle-orm";
import { AppError } from "@shared/errors/app-error";
import { type ClipUpdateBody, updateArticleClipForUser } from "./articles.clips";
import type { ArticleUpdateBody } from "./articles.types";

type DB = typeof db;

async function assertUserCanAccessArticle(database: DB, userId: string, articleId: string) {
  const rows = await database
    .select({ id: feedItems.id })
    .from(feedItems)
    .innerJoin(
      feedSubscriptions,
      and(eq(feedItems.feedId, feedSubscriptions.feedId), eq(feedSubscriptions.userId, userId)),
    )
    .where(eq(feedItems.id, articleId))
    .limit(1);
  if (!rows[0]) {
    throw new AppError("Article not found", { status: 404, code: "ARTICLE_NOT_FOUND" });
  }
}

export async function updateArticleForUser(
  database: DB,
  userId: string,
  articleId: string,
  body: ArticleUpdateBody,
): Promise<void> {
  const hasRead = Object.hasOwn(body, "isRead");
  const hasSaved = Object.hasOwn(body, "isSaved");
  if (!hasRead && !hasSaved) {
    throw new AppError("No updatable fields provided", { status: 400, code: "EMPTY_UPDATE" });
  }

  await assertUserCanAccessArticle(database, userId, articleId);

  const existing = await database
    .select({
      readOverride: feedItemUserState.readOverride,
      isSaved: feedItemUserState.isSaved,
    })
    .from(feedItemUserState)
    .where(and(eq(feedItemUserState.userId, userId), eq(feedItemUserState.feedItemId, articleId)))
    .limit(1);

  const prev = existing[0];
  const readOverride = hasRead ? body.isRead! : (prev?.readOverride ?? null);
  const isSaved = hasSaved ? body.isSaved! : (prev?.isSaved ?? false);

  const now = new Date();
  await database
    .insert(feedItemUserState)
    .values({
      userId,
      feedItemId: articleId,
      readOverride,
      isSaved,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [feedItemUserState.userId, feedItemUserState.feedItemId],
      set: {
        readOverride,
        isSaved,
        updatedAt: now,
      },
    });
}

export async function updateArticleOrClipForUser(
  database: DB,
  userId: string,
  articleId: string,
  raw: Record<string, unknown>,
): Promise<void> {
  const clipRows = await database
    .select({ id: articleClips.id })
    .from(articleClips)
    .where(and(eq(articleClips.id, articleId), eq(articleClips.userId, userId)))
    .limit(1);

  if (clipRows[0]) {
    const clipBody: ClipUpdateBody = {};
    if (Object.hasOwn(raw, "isRead")) {
      clipBody.isRead = raw.isRead as boolean | null;
    }
    if (Object.hasOwn(raw, "isSaved")) {
      clipBody.isSaved = raw.isSaved as boolean;
    }
    if (Object.hasOwn(raw, "title")) {
      clipBody.title = raw.title as string;
    }
    if (Object.hasOwn(raw, "note")) {
      clipBody.note = raw.note as string | null;
    }
    if (Object.hasOwn(raw, "content")) {
      clipBody.content = raw.content as string | null;
    }
    const ok = await updateArticleClipForUser(database, userId, articleId, clipBody);
    if (!ok) {
      throw new AppError("Article not found", { status: 404, code: "ARTICLE_NOT_FOUND" });
    }
    return;
  }

  const feedBody: ArticleUpdateBody = {};
  if (Object.hasOwn(raw, "isRead")) {
    feedBody.isRead = raw.isRead as boolean | null;
  }
  if (Object.hasOwn(raw, "isSaved")) {
    feedBody.isSaved = raw.isSaved as boolean;
  }
  await updateArticleForUser(database, userId, articleId, feedBody);
}
