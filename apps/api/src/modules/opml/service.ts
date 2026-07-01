import type { db } from "@adapters/db/client";
import { publishJob } from "@adapters/queue/publish-job";
import { getRedis } from "@adapters/redis";
import { enqueueFeedRefresh } from "@modules/feeds/refresh/service";
import { createOrSubscribeToFeed } from "@modules/feeds/subscription/service";
import { DEFAULT_FOLDER_NAME, getOrCreateFolderByName } from "@modules/folders/service";
import { AppError } from "@shared/errors/app";
import { parseOpmlDocument } from "./parse";
import {
  failOpmlTask,
  initializeOpmlTask,
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
  userId: string,
  xml: string,
  logger: Logger,
  filename = "inline.opml",
): Promise<{ taskId: string }> {
  const normalizedFilename = assertSupportedFilename(filename);
  const document = parseOpmlDocument(xml, DEFAULT_FOLDER_NAME);
  const taskId = crypto.randomUUID();

  await initializeOpmlTask({
    taskId,
    userId,
    filename: normalizedFilename,
    opmlTitle: document.opmlTitle,
    opmlAuthor: document.opmlAuthor,
    totalUrls: document.feeds.length,
  });

  try {
    const redis = getRedis();
    await publishJob(redis, {
      type: "opml.import",
      payload: {
        taskId,
        userId,
        xml,
        filename: normalizedFilename,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failOpmlTask(taskId, `Failed to enqueue import: ${message}`);
    logger.error("opml.import.enqueue.failed", { userId, taskId, error: message });
    throw new AppError("Failed to start OPML import", {
      status: 503,
      code: "QUEUE_UNAVAILABLE",
    });
  }

  logger.info("opml.import.enqueued", {
    userId,
    taskId,
    filename: normalizedFilename,
    totalUrls: document.feeds.length,
  });
  return { taskId };
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
