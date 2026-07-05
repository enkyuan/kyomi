import type { db } from "@adapters/db/client";
import {
  articleClips,
  articleViewEvents,
  feedItemUserState,
  feedItems,
  feedUserStats,
} from "@kyomi/db";
import { and, eq, sql } from "drizzle-orm";
import { AppError } from "@shared/errors/app";
import { type ClipUpdateBody, updateArticleClipForUser } from "./clips/operations";
import type { ArticleUpdateBody } from "../types";

type DB = typeof db;

async function getFeedArticleOrThrow(database: DB, articleId: string) {
  const rows = await database
    .select({ id: feedItems.id, feedId: feedItems.feedId })
    .from(feedItems)
    .where(eq(feedItems.id, articleId))
    .limit(1);
  const article = rows[0];
  if (!article) {
    throw new AppError("Article not found", { status: 404, code: "ARTICLE_NOT_FOUND" });
  }
  return article;
}

export async function updateArticleForUser(
  database: DB,
  userId: string,
  articleId: string,
  body: ArticleUpdateBody,
): Promise<void> {
  const hasRead = Object.hasOwn(body, "isRead");
  const hasSaved = Object.hasOwn(body, "isSaved");
  const hasHidden = Object.hasOwn(body, "isHidden");
  const hasContentFields =
    Object.hasOwn(body, "contentHtml") ||
    Object.hasOwn(body, "contentText") ||
    Object.hasOwn(body, "contentMarkdown") ||
    Object.hasOwn(body, "contentStatus") ||
    Object.hasOwn(body, "contentSource") ||
    Object.hasOwn(body, "extractionErrorCode") ||
    Object.hasOwn(body, "extractionErrorMessage");
  if (!hasRead && !hasSaved && !hasHidden && !hasContentFields) {
    throw new AppError("No updatable fields provided", { status: 400, code: "EMPTY_UPDATE" });
  }

  await getFeedArticleOrThrow(database, articleId);

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

  if (hasRead || hasSaved || hasHidden) {
    const existing = await database
      .select({
        readOverride: feedItemUserState.readOverride,
        isSaved: feedItemUserState.isSaved,
        savedAt: feedItemUserState.savedAt,
        hiddenAt: feedItemUserState.hiddenAt,
      })
      .from(feedItemUserState)
      .where(and(eq(feedItemUserState.userId, userId), eq(feedItemUserState.feedItemId, articleId)))
      .limit(1);

    const prev = existing[0];
    const readOverride = hasRead ? body.isRead! : (prev?.readOverride ?? null);
    const isSaved = hasSaved ? body.isSaved! : (prev?.isSaved ?? false);
    const savedAt = hasSaved
      ? body.isSaved
        ? (prev?.savedAt ?? now)
        : null
      : (prev?.savedAt ?? null);
    const hiddenAt = hasHidden ? (body.isHidden ? now : null) : (prev?.hiddenAt ?? null);

    await database
      .insert(feedItemUserState)
      .values({
        userId,
        feedItemId: articleId,
        readOverride,
        isSaved,
        savedAt,
        hiddenAt,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [feedItemUserState.userId, feedItemUserState.feedItemId],
        set: {
          readOverride,
          isSaved,
          savedAt,
          hiddenAt,
          updatedAt: now,
        },
      });
  }
}

export async function recordArticleViewForUser(
  database: DB,
  userId: string,
  articleId: string,
): Promise<void> {
  const now = new Date();
  const updatedClips = await database
    .update(articleClips)
    .set({ lastViewedAt: now, updatedAt: now })
    .where(and(eq(articleClips.id, articleId), eq(articleClips.userId, userId)))
    .returning({ id: articleClips.id });

  if (updatedClips[0]) {
    await database.insert(articleViewEvents).values({
      id: crypto.randomUUID(),
      userId,
      clipId: articleId,
      articleType: "clip",
      isFirstView: false,
      viewedAt: now,
    });
    return;
  }

  const article = await getFeedArticleOrThrow(database, articleId);
  const insertedState = await database
    .insert(feedItemUserState)
    .values({
      userId,
      feedItemId: articleId,
      readOverride: null,
      isSaved: false,
      lastViewedAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning({ feedItemId: feedItemUserState.feedItemId });

  let isFirstView = Boolean(insertedState[0]);
  if (!isFirstView) {
    const firstViewedState = await database
      .update(feedItemUserState)
      .set({ lastViewedAt: now, updatedAt: now })
      .where(
        and(
          eq(feedItemUserState.userId, userId),
          eq(feedItemUserState.feedItemId, articleId),
          sql`${feedItemUserState.lastViewedAt} IS NULL`,
        ),
      )
      .returning({ feedItemId: feedItemUserState.feedItemId });

    isFirstView = Boolean(firstViewedState[0]);
    if (!isFirstView) {
      await database
        .update(feedItemUserState)
        .set({ lastViewedAt: now, updatedAt: now })
        .where(
          and(eq(feedItemUserState.userId, userId), eq(feedItemUserState.feedItemId, articleId)),
        );
    }
  }

  await database.insert(articleViewEvents).values({
    id: crypto.randomUUID(),
    userId,
    feedItemId: articleId,
    feedId: article.feedId,
    articleType: "feed",
    isFirstView,
    viewedAt: now,
  });

  if (isFirstView) {
    await database
      .insert(feedUserStats)
      .values({
        userId,
        feedId: article.feedId,
        viewedItemCount: 1,
        lastViewedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [feedUserStats.userId, feedUserStats.feedId],
        set: {
          viewedItemCount: sql`${feedUserStats.viewedItemCount} + 1`,
          lastViewedAt: now,
          updatedAt: now,
        },
      });
    return;
  }

  const updatedStats = await database
    .update(feedUserStats)
    .set({ lastViewedAt: now, updatedAt: now })
    .where(and(eq(feedUserStats.userId, userId), eq(feedUserStats.feedId, article.feedId)))
    .returning({ feedId: feedUserStats.feedId });

  if (!updatedStats[0]) {
    await database
      .insert(feedUserStats)
      .values({
        userId,
        feedId: article.feedId,
        viewedItemCount: 1,
        lastViewedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [feedUserStats.userId, feedUserStats.feedId],
        set: {
          lastViewedAt: now,
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
    if (Object.hasOwn(raw, "isHidden")) {
      throw new AppError("Clips cannot be hidden from feed views", {
        status: 400,
        code: "CLIP_HIDE_UNSUPPORTED",
      });
    }
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
  if (Object.hasOwn(raw, "isHidden")) {
    feedBody.isHidden = raw.isHidden as boolean;
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
