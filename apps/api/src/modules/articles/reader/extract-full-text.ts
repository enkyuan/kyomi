import type { db } from "@adapters/db/client";
import { articleClips, feedItems } from "@vols.rss/db";
import { assertHttpOrHttpsUrl } from "@modules/discover/normalize-feed-url";
import { eq } from "drizzle-orm";
import { getArticleDetailForUser } from "../read/detail";
import { extractArticleContentFromUrl } from "./extract-content";
import type { ArticleDetailDto } from "../types";

type DB = typeof db;

function safeExtractErrorMessage(raw: string, maxLen = 280): string {
  const t = raw.trim();
  if (!t) {
    return "Full text could not be extracted.";
  }
  return t.length > maxLen ? `${t.slice(0, maxLen)}…` : t;
}

async function persistFeedExtracted(
  database: DB,
  articleId: string,
  payload: { kind: "ready"; html: string; text: string } | { kind: "failed"; message: string },
) {
  const now = new Date();
  if (payload.kind === "ready") {
    await database
      .update(feedItems)
      .set({
        extractedContentHtml: payload.html,
        extractedContentText: payload.text,
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
  payload: { kind: "ready"; html: string; text: string } | { kind: "failed"; message: string },
) {
  const now = new Date();
  if (payload.kind === "ready") {
    await database
      .update(articleClips)
      .set({
        extractedContentHtml: payload.html,
        extractedContentText: payload.text,
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
        extractedContentStatus: "failed",
        extractedContentError: payload.message,
        extractedContentUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(articleClips.id, articleId));
  }
}

/**
 * On-demand source-page extraction. Persists to extracted* columns only; feed content fields stay unchanged.
 */
export async function extractFullTextForUser(
  database: DB,
  userId: string,
  articleId: string,
): Promise<
  | { ok: true; article: ArticleDetailDto }
  | { ok: false; errorCode: string; errorMessage: string; article: ArticleDetailDto }
> {
  const before = await getArticleDetailForUser(database, userId, articleId);

  try {
    assertHttpOrHttpsUrl(before.link);
  } catch {
    const msg = "A valid public http(s) article URL is required.";
    if (before.articleType === "feed") {
      await persistFeedExtracted(database, articleId, { kind: "failed", message: msg });
    } else {
      await persistClipExtracted(database, articleId, { kind: "failed", message: msg });
    }
    const article = await getArticleDetailForUser(database, userId, articleId);
    return { ok: false, errorCode: "INVALID_URL", errorMessage: msg, article };
  }

  const extracted = await extractArticleContentFromUrl(before.link);

  if (!extracted.ok) {
    const message = safeExtractErrorMessage(extracted.errorMessage);
    if (before.articleType === "feed") {
      await persistFeedExtracted(database, articleId, { kind: "failed", message });
    } else {
      await persistClipExtracted(database, articleId, { kind: "failed", message });
    }
    const article = await getArticleDetailForUser(database, userId, articleId);
    return {
      ok: false,
      errorCode: extracted.errorCode,
      errorMessage: message,
      article,
    };
  }

  const html = extracted.content.contentHtml?.trim();
  const text = extracted.content.contentText?.trim() ?? "";
  if (!html) {
    const message = "No readable article body was found.";
    if (before.articleType === "feed") {
      await persistFeedExtracted(database, articleId, { kind: "failed", message });
    } else {
      await persistClipExtracted(database, articleId, { kind: "failed", message });
    }
    const article = await getArticleDetailForUser(database, userId, articleId);
    return {
      ok: false,
      errorCode: "NO_READABLE_CONTENT",
      errorMessage: message,
      article,
    };
  }

  if (before.articleType === "feed") {
    await persistFeedExtracted(database, articleId, { kind: "ready", html, text });
  } else {
    await persistClipExtracted(database, articleId, { kind: "ready", html, text });
  }

  const article = await getArticleDetailForUser(database, userId, articleId);
  return { ok: true, article };
}
