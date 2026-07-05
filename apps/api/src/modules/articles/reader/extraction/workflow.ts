import type { db } from "@adapters/db/client";
import { articleClips, categories, feedItemCategoryAssignments, feedItems } from "@kyomi/db";
import { assertHttpOrHttpsUrl } from "@modules/discover/feed/normalize";
import { and, eq, ne } from "drizzle-orm";
import { getArticleDetailForUser } from "@modules/articles/read/detail";
import type { ArticleDetailDto } from "@modules/articles/types";
import {
  CATEGORY_CLASSIFIER_PROVENANCE,
  classifyItemEmbedding,
  embeddingModelInfo,
  MAX_CLASSIFIER_LABELS,
  syncItemInferences,
  type EmbeddingClassifierConfig,
} from "@kyomi/worker";
import { extractArticleContentFromUrl } from "./readability";

type DB = typeof db;
type ExtractionLogger = {
  warn?: (message: string, data?: Record<string, unknown>) => void;
};

type ExtractFullTextOptions = {
  embeddingClassifier?: EmbeddingClassifierConfig;
  logger?: ExtractionLogger;
};

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

async function loadExplicitItemCategoryLabels(database: DB, articleId: string): Promise<string[]> {
  const rows = await database
    .select({ label: categories.label })
    .from(feedItemCategoryAssignments)
    .innerJoin(categories, eq(feedItemCategoryAssignments.categoryId, categories.id))
    .where(
      and(
        eq(feedItemCategoryAssignments.feedItemId, articleId),
        ne(feedItemCategoryAssignments.provenance, CATEGORY_CLASSIFIER_PROVENANCE),
      ),
    );

  return rows.map((row) => row.label);
}

export async function reclassifyExtractedFeedItem(
  database: DB,
  article: ArticleDetailDto,
  extractedText: string,
  options: ExtractFullTextOptions,
): Promise<void> {
  const config = options.embeddingClassifier;
  if (!config || article.articleType !== "feed") {
    return;
  }

  try {
    const explicitLabels = await loadExplicitItemCategoryLabels(database, article.id);
    const explicitLabelSet = new Set(explicitLabels);
    const remainingChipSlots = Math.max(0, MAX_CLASSIFIER_LABELS - explicitLabels.length);

    if (remainingChipSlots === 0) {
      await syncItemInferences(
        database,
        {
          items: [{ id: article.id, inferredCategoryLabels: [] }],
          model: embeddingModelInfo(config),
        },
        new Date(),
      );
      return;
    }

    const classification = await classifyItemEmbedding(
      {
        feedTitle: article.feedTitle,
        feedDescription: null,
        feedUrl: article.feedUrl ?? article.link,
        feedSiteUrl: article.feedSiteUrl,
        sourceKind: null,
        itemTitle: article.title,
        itemSummary: article.summary,
        itemContentText: extractedText,
        itemUrl: article.link,
      },
      config,
      remainingChipSlots + explicitLabels.length,
    );
    const inferredCategoryLabels = classification.categories
      .filter((category) => !explicitLabelSet.has(category.label))
      .slice(0, remainingChipSlots);

    await syncItemInferences(
      database,
      {
        items: [{ id: article.id, inferredCategoryLabels }],
        model: embeddingModelInfo(config),
      },
      new Date(),
    );
  } catch (error) {
    options.logger?.warn?.("articles.extract_full_text.categories_reclassify_failed", {
      articleId: article.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * On-demand source-page extraction. Persists to extracted* columns only; feed content fields stay unchanged.
 */
export async function extractFullTextForUser(
  database: DB,
  userId: string,
  articleId: string,
  options: ExtractFullTextOptions = {},
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
    await reclassifyExtractedFeedItem(database, before, text, options);
  } else {
    await persistClipExtracted(database, articleId, { kind: "ready", html, text });
  }

  const article = await getArticleDetailForUser(database, userId, articleId);
  return { ok: true, article };
}
