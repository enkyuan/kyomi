import type { db } from "@adapters/db/client";
import { publishJob } from "@adapters/queue/publish-job";
import { getRedis } from "@adapters/redis";
import { enqueueFeedRefresh } from "@modules/feeds/refresh/enqueue";
import { createOrSubscribeToFeed } from "@modules/feeds/subscription/subscribe";
import {
  DEFAULT_FOLDER_NAME,
  ensureFoldersByName,
  getOrCreateFolderByName,
} from "@modules/folders/operations";
import { AppError } from "@shared/errors/app";
import {
  matchKnownFeedsForImport,
  publishKnownFeedRefreshCandidates,
  subscribeKnownOpmlItems,
} from "./known-feeds";
import { parseOpmlDocument } from "./parse";
import {
  claimOpmlPreparation,
  createOpmlImport,
  failOpmlImportPreparation,
  finalizeOpmlImportPreparation,
  insertOpmlImportItems,
  recordOpmlImportMaterialized,
  recordOpmlImportPrepareWakeup,
  recordOpmlPreparationHeartbeat,
} from "./store";
import {
  failOpmlTask,
  isOpmlTaskCancelled,
  markOpmlTaskInProgress,
  recordOpmlTaskFailure,
  recordOpmlTaskSuccess,
} from "./task-store";

type DB = typeof db;
type Logger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
};

function assertSupportedFilename(filename: string): string {
  const trimmed = filename.trim();
  if (!trimmed) {
    return "inline.opml";
  }
  if (!/\.(opml|xml)$/i.test(trimmed)) {
    throw new AppError("Invalid file type. Please provide a .opml or .xml filename.", {
      status: 400,
      code: "OPML_FILE_TYPE_INVALID",
    });
  }
  return trimmed;
}

export async function enqueueOpmlImport(
  database: DB,
  userId: string,
  xml: string,
  logger: Logger,
  filename = "inline.opml",
  sourceUrl?: string | null,
): Promise<{ taskId: string }> {
  const normalizedFilename = assertSupportedFilename(filename);
  const created = await createOpmlImport(database, {
    userId,
    filename: normalizedFilename,
    sourceUrl,
    sourceXml: xml,
  });

  try {
    const redis = getRedis();
    await publishJob(redis, {
      type: "opml.import.prepare",
      payload: { importId: created.id },
    });
    await recordOpmlImportPrepareWakeup(database, created.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("opml.import.prepare.delivery_pending", {
      userId,
      taskId: created.id,
      error: message,
    });
  }

  logger.info("opml.import.enqueued", {
    userId,
    taskId: created.id,
    filename: normalizedFilename,
  });
  return { taskId: created.id };
}

export async function runOpmlImportJob(
  database: DB,
  payload: { taskId: string; userId: string; xml: string; filename: string },
  logger: Logger,
): Promise<void> {
  const { taskId, userId, xml, filename } = payload;
  if (await isOpmlTaskCancelled(taskId)) {
    logger.info("worker.job.opml_import.cancelled_before_start", { taskId, userId });
    return;
  }

  try {
    const document = parseOpmlDocument(xml, DEFAULT_FOLDER_NAME);
    await markOpmlTaskInProgress(taskId);

    const folderNames = [...new Set(document.feeds.map((feed) => feed.folderName))].filter(
      (name) => name !== DEFAULT_FOLDER_NAME,
    );
    const folderMap = new Map<string, string>();

    for (const folderName of folderNames) {
      const folder = await getOrCreateFolderByName(database, userId, folderName);
      folderMap.set(folderName, folder.id);
    }

    for (const feed of document.feeds) {
      if (await isOpmlTaskCancelled(taskId)) {
        logger.info("worker.job.opml_import.cancelled_mid_dispatch", { taskId, userId });
        return;
      }

      try {
        await publishJob(getRedis(), {
          type: "opml.import.feed",
          payload: {
            taskId,
            userId,
            url: feed.xmlUrl,
            title: feed.title ?? undefined,
            folderId: folderMap.get(feed.folderName) ?? null,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await recordOpmlTaskFailure(taskId, {
          url: feed.xmlUrl,
          code: "QUEUE_UNAVAILABLE",
          message,
        });
        logger.error("worker.job.opml_import.dispatch_failed", {
          taskId,
          userId,
          url: feed.xmlUrl,
          filename,
          error: message,
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failOpmlTask(taskId, message);
    logger.error("worker.job.opml_import.failed", { taskId, userId, filename, error: message });
    throw error;
  }
}

export async function runOpmlImportFeedJob(
  database: DB,
  payload: {
    taskId: string;
    userId: string;
    url: string;
    title?: string;
    folderId?: string | null;
  },
  logger: Logger,
): Promise<void> {
  const { taskId, userId, url, title, folderId } = payload;
  if (await isOpmlTaskCancelled(taskId)) {
    logger.info("worker.job.opml_import_feed.cancelled", { taskId, userId, url });
    return;
  }

  try {
    const result = await createOrSubscribeToFeed(database, userId, url, {
      folderId: folderId ?? null,
      customTitle: title ?? null,
    });

    if (result.newSubscription) {
      await enqueueFeedRefresh(database, result.feedId, userId, "subscription_created", logger);
    }

    await recordOpmlTaskSuccess(taskId, {
      alreadySubscribed: !result.newSubscription,
    });
  } catch (error) {
    const err =
      error instanceof AppError
        ? error
        : new AppError(error instanceof Error ? error.message : "Import failed", {
            status: 500,
            code: "OPML_FEED_IMPORT_FAILED",
          });

    await recordOpmlTaskFailure(taskId, {
      url,
      code: err.code,
      message: err.message,
    });

    logger.error("worker.job.opml_import_feed.failed", {
      taskId,
      userId,
      url,
      error: err.message,
      code: err.code,
    });
  }
}

export async function runOpmlImportPrepareJob(
  database: DB,
  payload: { importId: string },
  logger: Logger,
): Promise<void> {
  const { importId } = payload;
  const claimed = await claimOpmlPreparation(database, importId);
  if (!claimed) {
    logger.info("worker.job.opml_import_prepare.duplicate_or_missing", { importId });
    return;
  }

  try {
    const document = parseOpmlDocument(claimed.sourceXml, DEFAULT_FOLDER_NAME);
    const folderNames = [...new Set(document.feeds.map((feed) => feed.folderName))].filter(
      (name) => name !== DEFAULT_FOLDER_NAME,
    );
    const folderMap = await ensureFoldersByName(database, claimed.userId, folderNames);

    await insertOpmlImportItems(database, importId, document.feeds, folderMap);
    await recordOpmlImportMaterialized(database, importId, {
      totalItems: document.feeds.length,
      opmlTitle: document.opmlTitle,
      opmlAuthor: document.opmlAuthor,
    });
    await recordOpmlPreparationHeartbeat(database, importId);

    await matchKnownFeedsForImport(database, importId);
    while (true) {
      const completion = await subscribeKnownOpmlItems(database, importId, claimed.userId);
      if (completion.refreshCandidateFeedIds.length > 0) {
        await publishKnownFeedRefreshCandidates(
          database,
          claimed.userId,
          completion.refreshCandidateFeedIds,
          logger,
        );
      }
      await recordOpmlPreparationHeartbeat(database, importId);
      if (completion.processed === 0) {
        break;
      }
      await matchKnownFeedsForImport(database, importId);
    }

    await finalizeOpmlImportPreparation(database, importId);

    logger.info("worker.job.opml_import_prepare.completed", {
      importId,
      totalItems: document.feeds.length,
    });
  } catch (error) {
    if (!(error instanceof AppError)) {
      // Platform (database/Redis) errors are not the source XML's fault: rethrow so the
      // queue retries instead of permanently failing an import over a transient outage.
      throw error;
    }
    await failOpmlImportPreparation(database, importId, {
      code: error.code,
      message: error.message,
    });
    logger.error("worker.job.opml_import_prepare.failed", {
      importId,
      error: error.message,
      code: error.code,
    });
  }
}
