import type { db } from "@adapters/db/client";
import { articleClips, feedItemUserState, feedItems, feedSubscriptions } from "@kyomi/db";
import { and, eq } from "drizzle-orm";
import { AppError } from "@shared/errors/app";
import { type ClipUpdateBody, updateArticleClipForUser } from "./clips";
import type { ArticleUpdateBody } from "../types";

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
  const hasContentFields =
    Object.hasOwn(body, "contentHtml") ||
    Object.hasOwn(body, "contentText") ||
    Object.hasOwn(body, "contentMarkdown") ||
    Object.hasOwn(body, "contentStatus") ||
    Object.hasOwn(body, "contentSource") ||
    Object.hasOwn(body, "extractionErrorCode") ||
    Object.hasOwn(body, "extractionErrorMessage");
  if (!hasRead && !hasSaved && !hasContentFields) {
    throw new AppError("No updatable fields provided", { status: 400, code: "EMPTY_UPDATE" });
  }

  await assertUserCanAccessArticle(database, userId, articleId);

  const now = new Date();

  if (hasContentFields) {
    await database
      .update(feedItems)
      .set({
        contentHtml: Object.hasOwn(body, "contentHtml") ? body.contentHtml : undefined,
        contentText: Object.hasOwn(body, "contentText") ? body.contentText : undefined,
        contentMarkdown: Object.hasOwn(body, "contentMarkdown") ? body.contentMarkdown : undefined,
        contentStatus: Object.hasOwn(body, "contentStatus") ? body.contentStatus : undefined,
        contentSource: Object.hasOwn(body, "contentSource") ? body.contentSource : undefined,
        extractionErrorCode: Object.hasOwn(body, "extractionErrorCode")
          ? body.extractionErrorCode
          : undefined,
        extractionErrorMessage: Object.hasOwn(body, "extractionErrorMessage")
          ? body.extractionErrorMessage
          : undefined,
        updatedAt: now,
      })
      .where(eq(feedItems.id, articleId));
  }

  if (hasRead || hasSaved) {
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
    if (Object.hasOwn(raw, "contentHtml")) {
      clipBody.contentHtml = raw.contentHtml as string | null;
    }
    if (Object.hasOwn(raw, "contentText")) {
      clipBody.contentText = raw.contentText as string | null;
    }
    if (Object.hasOwn(raw, "contentMarkdown")) {
      clipBody.contentMarkdown = raw.contentMarkdown as string | null;
    }
    if (Object.hasOwn(raw, "contentStatus")) {
      clipBody.contentStatus = raw.contentStatus as ClipUpdateBody["contentStatus"];
    }
    if (Object.hasOwn(raw, "contentSource")) {
      clipBody.contentSource = raw.contentSource as ClipUpdateBody["contentSource"];
    }
    if (Object.hasOwn(raw, "extractionErrorCode")) {
      clipBody.extractionErrorCode = raw.extractionErrorCode as string | null;
    }
    if (Object.hasOwn(raw, "extractionErrorMessage")) {
      clipBody.extractionErrorMessage = raw.extractionErrorMessage as string | null;
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
  if (Object.hasOwn(raw, "contentHtml")) {
    feedBody.contentHtml = raw.contentHtml as string | null;
  }
  if (Object.hasOwn(raw, "contentText")) {
    feedBody.contentText = raw.contentText as string | null;
  }
  if (Object.hasOwn(raw, "contentMarkdown")) {
    feedBody.contentMarkdown = raw.contentMarkdown as string | null;
  }
  if (Object.hasOwn(raw, "contentStatus")) {
    feedBody.contentStatus = raw.contentStatus as ArticleUpdateBody["contentStatus"];
  }
  if (Object.hasOwn(raw, "contentSource")) {
    feedBody.contentSource = raw.contentSource as ArticleUpdateBody["contentSource"];
  }
  if (Object.hasOwn(raw, "extractionErrorCode")) {
    feedBody.extractionErrorCode = raw.extractionErrorCode as string | null;
  }
  if (Object.hasOwn(raw, "extractionErrorMessage")) {
    feedBody.extractionErrorMessage = raw.extractionErrorMessage as string | null;
  }
  await updateArticleForUser(database, userId, articleId, feedBody);
}
