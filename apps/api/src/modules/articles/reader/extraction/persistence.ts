import type { db } from "@adapters/db/client";
import { articleClips, feedItems } from "@kyomi/db";
import type { ArticleDetailDto } from "@modules/articles/types";
import { eq } from "drizzle-orm";

type DB = typeof db;
type ExtractedPersistencePayload =
  | { kind: "ready"; html: string; text: string; sanitizerVersion: string }
  | { kind: "failed"; message: string };

export async function persistPendingExtracted(database: DB, article: ArticleDetailDto) {
  const now = new Date();
  if (article.articleType === "feed") {
    await database
      .update(feedItems)
      .set({
        extractedContentStatus: "pending",
        extractedContentError: null,
        extractedContentUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(feedItems.id, article.id));
    return;
  }

  await database
    .update(articleClips)
    .set({
      extractedContentStatus: "pending",
      extractedContentError: null,
      extractedContentUpdatedAt: now,
      updatedAt: now,
    })
    .where(eq(articleClips.id, article.id));
}

async function persistFeedExtracted(
  database: DB,
  articleId: string,
  payload: ExtractedPersistencePayload,
) {
  const now = new Date();
  if (payload.kind === "ready") {
    await database
      .update(feedItems)
      .set({
        extractedContentHtml: payload.html,
        extractedContentText: payload.text,
        extractedContentSanitizerVersion: payload.sanitizerVersion,
        extractedContentStatus: "ready",
        extractedContentError: null,
        extractedContentUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(feedItems.id, articleId));
  } else {
    await database
      .update(feedItems)
      .set({
        extractedContentHtml: null,
        extractedContentText: null,
        extractedContentSanitizerVersion: null,
        extractedContentStatus: "failed",
        extractedContentError: payload.message,
        extractedContentUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(feedItems.id, articleId));
  }
}

async function persistClipExtracted(
  database: DB,
  articleId: string,
  payload: ExtractedPersistencePayload,
) {
  const now = new Date();
  if (payload.kind === "ready") {
    await database
      .update(articleClips)
      .set({
        extractedContentHtml: payload.html,
        extractedContentText: payload.text,
        extractedContentSanitizerVersion: payload.sanitizerVersion,
        extractedContentStatus: "ready",
        extractedContentError: null,
        extractedContentUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(articleClips.id, articleId));
  } else {
    await database
      .update(articleClips)
      .set({
        extractedContentHtml: null,
        extractedContentText: null,
        extractedContentSanitizerVersion: null,
        extractedContentStatus: "failed",
        extractedContentError: payload.message,
        extractedContentUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(articleClips.id, articleId));
  }
}

export async function persistExtracted(
  database: DB,
  article: ArticleDetailDto,
  payload: ExtractedPersistencePayload,
) {
  if (article.articleType === "feed") {
    await persistFeedExtracted(database, article.id, payload);
    return;
  }

  await persistClipExtracted(database, article.id, payload);
}
