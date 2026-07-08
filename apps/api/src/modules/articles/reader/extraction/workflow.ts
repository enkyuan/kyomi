import type { db } from "@adapters/db/client";
import { getRedis } from "@adapters/redis";
import { publishJob } from "@adapters/queue/publish-job";
import { categories, feedItemCategoryAssignments } from "@kyomi/db";
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
  type ArticleExtractionJob,
  type EmbeddingClassifierConfig,
} from "@kyomi/worker";
import {
  normalizeExtractionUrlKey,
  readFreshExtractionCache,
  safeExtractErrorMessage,
  upsertFailedExtractionCache,
  upsertReadyExtractionCache,
} from "./cache";
import {
  persistClipExtracted,
  persistExtracted,
  persistFeedExtracted,
  persistPendingExtracted,
} from "./persistence";
import { extractArticleContentFromUrl } from "./readability";

type DB = typeof db;
type ExtractionLogger = {
  info?: (message: string, data?: Record<string, unknown>) => void;
  warn?: (message: string, data?: Record<string, unknown>) => void;
  error?: (message: string, data?: Record<string, unknown>) => void;
};

type ExtractFullTextOptions = {
  enqueueExtractionJob?: (job: ArticleExtractionJob) => Promise<string>;
  embeddingClassifier?: EmbeddingClassifierConfig;
  logger?: ExtractionLogger;
};

type ExtractFullTextResult =
  | { ok: true; status: "ready"; article: ArticleDetailDto }
  | { ok: true; status: "queued"; article: ArticleDetailDto }
  | {
      ok: false;
      status: "failed";
      errorCode: string;
      errorMessage: string;
      article: ArticleDetailDto;
    };

async function defaultEnqueueExtractionJob(job: ArticleExtractionJob): Promise<string> {
  return publishJob(getRedis(), job);
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

export async function requestFullTextExtractionForUser(
  database: DB,
  userId: string,
  articleId: string,
  options: ExtractFullTextOptions = {},
): Promise<ExtractFullTextResult> {
  const before = await getArticleDetailForUser(database, userId, articleId);

  try {
    assertHttpOrHttpsUrl(before.link);
  } catch {
    const msg = "A valid public http(s) article URL is required.";
    await persistExtracted(database, before, { kind: "failed", message: msg });
    const article = await getArticleDetailForUser(database, userId, articleId);
    return { ok: false, status: "failed", errorCode: "INVALID_URL", errorMessage: msg, article };
  }

  if (before.reader.extracted.status === "ready" && before.reader.extracted.content) {
    return { ok: true, status: "ready", article: before };
  }

  if (before.reader.extracted.status === "pending" && before.reader.extracted.updatedAt) {
    return { ok: true, status: "queued", article: before };
  }

  await persistPendingExtracted(database, before);
  const article = await getArticleDetailForUser(database, userId, articleId);

  try {
    const enqueueExtractionJob = options.enqueueExtractionJob ?? defaultEnqueueExtractionJob;
    await enqueueExtractionJob({
      type: "article.extract",
      payload: {
        articleId,
        userId,
        requestedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    options.logger?.error?.("articles.extract_full_text.enqueue_failed", {
      userId,
      articleId,
      error: error instanceof Error ? error.message : String(error),
    });
    const message = "Full text extraction could not be queued.";
    await persistExtracted(database, before, { kind: "failed", message });
    const failedArticle = await getArticleDetailForUser(database, userId, articleId);
    return {
      ok: false,
      status: "failed",
      errorCode: "QUEUE_UNAVAILABLE",
      errorMessage: message,
      article: failedArticle,
    };
  }

  return { ok: true, status: "queued", article };
}

/**
 * Worker-side source-page extraction. Persists to extracted* columns only; feed content fields stay unchanged.
 */
export async function runArticleExtractionForUser(
  database: DB,
  userId: string,
  articleId: string,
  options: ExtractFullTextOptions = {},
): Promise<ExtractFullTextResult> {
  const before = await getArticleDetailForUser(database, userId, articleId);

  let sourceUrl: URL;
  try {
    sourceUrl = assertHttpOrHttpsUrl(before.link);
  } catch {
    const msg = "A valid public http(s) article URL is required.";
    await persistExtracted(database, before, { kind: "failed", message: msg });
    const article = await getArticleDetailForUser(database, userId, articleId);
    return { ok: false, status: "failed", errorCode: "INVALID_URL", errorMessage: msg, article };
  }

  if (before.reader.extracted.status === "ready" && before.reader.extracted.content) {
    return { ok: true, status: "ready", article: before };
  }

  const urlKey = normalizeExtractionUrlKey(sourceUrl);
  const cached = await readFreshExtractionCache(database, urlKey);

  if (cached?.kind === "ready") {
    await persistExtracted(database, before, {
      kind: "ready",
      html: cached.html,
      text: cached.text,
    });
    if (before.articleType === "feed") {
      await reclassifyExtractedFeedItem(database, before, cached.text, options);
    }
    const article = await getArticleDetailForUser(database, userId, articleId);
    return { ok: true, status: "ready", article };
  }

  if (cached?.kind === "failed") {
    await persistExtracted(database, before, { kind: "failed", message: cached.message });
    const article = await getArticleDetailForUser(database, userId, articleId);
    return {
      ok: false,
      status: "failed",
      errorCode: cached.errorCode,
      errorMessage: cached.message,
      article,
    };
  }

  const extracted = await extractArticleContentFromUrl(before.link);

  if (!extracted.ok) {
    const message = safeExtractErrorMessage(extracted.errorMessage);
    await upsertFailedExtractionCache(database, {
      urlKey,
      sourceUrl: sourceUrl.href,
      errorCode: extracted.errorCode,
      message,
    });
    await persistExtracted(database, before, { kind: "failed", message });
    const article = await getArticleDetailForUser(database, userId, articleId);
    return {
      ok: false,
      status: "failed",
      errorCode: extracted.errorCode,
      errorMessage: message,
      article,
    };
  }

  const html = extracted.content.contentHtml?.trim();
  const text = extracted.content.contentText?.trim() ?? "";
  if (!html) {
    const message = "No readable article body was found.";
    await upsertFailedExtractionCache(database, {
      urlKey,
      sourceUrl: sourceUrl.href,
      finalUrl: extracted.finalUrl,
      errorCode: "NO_READABLE_CONTENT",
      message,
    });
    await persistExtracted(database, before, { kind: "failed", message });
    const article = await getArticleDetailForUser(database, userId, articleId);
    return {
      ok: false,
      status: "failed",
      errorCode: "NO_READABLE_CONTENT",
      errorMessage: message,
      article,
    };
  }

  await upsertReadyExtractionCache(database, {
    urlKey,
    sourceUrl: sourceUrl.href,
    finalUrl: extracted.finalUrl,
    html,
    text,
  });

  if (before.articleType === "feed") {
    await persistFeedExtracted(database, articleId, { kind: "ready", html, text });
    await reclassifyExtractedFeedItem(database, before, text, options);
  } else {
    await persistClipExtracted(database, articleId, { kind: "ready", html, text });
  }

  const article = await getArticleDetailForUser(database, userId, articleId);
  return { ok: true, status: "ready", article };
}
