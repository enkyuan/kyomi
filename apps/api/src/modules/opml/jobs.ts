import { Clock, Effect } from "effect";
import { JobQueue } from "@adapters/queue/service";
import { AppLogger } from "@adapters/logger/service";
import { DEFAULT_FOLDER_NAME } from "@modules/folders/operations";
import { BadRequest, ERROR_CATALOGUE, isApiError, type PublicError } from "@shared/effect/errors";
import { serializeError } from "@shared/errors/serialize";
import { OpmlFeeds } from "./feeds";
import {
  matchKnownFeedsForImport,
  publishKnownFeedRefreshCandidates,
  subscribeKnownOpmlItems,
} from "./known";
import { parseOpmlDocument } from "./parse";
import { classifyOpmlItemError, computeOpmlRetryDelayMs, opmlRetryJitter } from "./retry";
import {
  claimLeasedOpmlItem,
  claimOpmlPreparation,
  completeOpmlItem,
  createOpmlImport,
  failOpmlImportPreparation,
  finalizeOpmlImportPreparation,
  insertOpmlImportItems,
  recordOpmlImportMaterialized,
  recordOpmlImportPrepareWakeup,
  recordOpmlPreparationHeartbeat,
  retryOrFailOpmlItem,
  withOpmlItemLeaseHeartbeat,
} from "./store";
import {
  failOpmlTask,
  isOpmlTaskCancelled,
  markOpmlTaskInProgress,
  recordOpmlTaskFailure,
  recordOpmlTaskSuccess,
} from "./task";

function distinctFolderNames(feeds: ReadonlyArray<{ folderName: string }>): string[] {
  return [...new Set(feeds.map((feed) => feed.folderName))].filter(
    (name) => name !== DEFAULT_FOLDER_NAME,
  );
}

/** Legacy `opml.import` job: parse in memory, then publish one `opml.import.feed` job per feed. */
export const runOpmlImportJob = Effect.fn("opml.job.import")(function* (payload: {
  taskId: string;
  userId: string;
  xml: string;
  filename: string;
}) {
  const { taskId, userId, xml, filename } = payload;
  const queue = yield* JobQueue;
  const log = yield* AppLogger;
  const feeds = yield* OpmlFeeds;
  if (yield* isOpmlTaskCancelled(taskId)) {
    yield* log.info("worker.job.opml_import.cancelled_before_start", { taskId, userId });
    return;
  }

  yield* Effect.gen(function* () {
    const document = yield* parseOpmlDocument(xml, DEFAULT_FOLDER_NAME);
    yield* markOpmlTaskInProgress(taskId);

    const folderMap = new Map<string, string>();
    for (const folderName of distinctFolderNames(document.feeds)) {
      const folder = yield* feeds.getOrCreateFolder(userId, folderName);
      folderMap.set(folderName, folder.id);
    }

    for (const feed of document.feeds) {
      if (yield* isOpmlTaskCancelled(taskId)) {
        yield* log.info("worker.job.opml_import.cancelled_mid_dispatch", { taskId, userId });
        return;
      }

      yield* queue
        .publish({
          type: "opml.import.feed",
          payload: {
            taskId,
            userId,
            url: feed.xmlUrl,
            title: feed.title ?? undefined,
            folderId: folderMap.get(feed.folderName) ?? null,
          },
        })
        .pipe(
          Effect.catchTag("RedisError", (error) =>
            recordOpmlTaskFailure(taskId, {
              url: feed.xmlUrl,
              code: "QUEUE_UNAVAILABLE",
              message: error.message,
            }).pipe(
              Effect.andThen(
                log.error("worker.job.opml_import.dispatch_failed", {
                  taskId,
                  userId,
                  url: feed.xmlUrl,
                  filename,
                  error: serializeError(error),
                }),
              ),
            ),
          ),
        );
    }
  }).pipe(
    Effect.tapError((error) =>
      failOpmlTask(taskId, error.message).pipe(
        Effect.andThen(
          log.error("worker.job.opml_import.failed", {
            taskId,
            userId,
            filename,
            error: serializeError(error),
          }),
        ),
      ),
    ),
  );
});

/**
 * Legacy `opml.import.feed` job: subscribe one URL and record the outcome on the Redis task. Every
 * failure is recorded against the task and the job still succeeds, so it is never retried.
 */
export const runOpmlImportFeedJob = Effect.fn("opml.job.import_feed")(function* (payload: {
  taskId: string;
  userId: string;
  url: string;
  title?: string;
  folderId?: string | null;
}) {
  const { taskId, userId, url, title, folderId } = payload;
  const log = yield* AppLogger;
  const feeds = yield* OpmlFeeds;
  if (yield* isOpmlTaskCancelled(taskId)) {
    yield* log.info("worker.job.opml_import_feed.cancelled", { taskId, userId, url });
    return;
  }

  yield* Effect.gen(function* () {
    const result = yield* feeds.subscribeToFeedUrl(userId, url, {
      folderId: folderId ?? null,
      customTitle: title ?? null,
    });

    if (result.newSubscription) {
      yield* feeds.requestInitialRefresh(result.feedId, userId);
    }

    yield* recordOpmlTaskSuccess(taskId, { alreadySubscribed: !result.newSubscription });
  }).pipe(
    Effect.catch((error) => {
      const { code, message } = classifyOpmlItemError(error);
      return recordOpmlTaskFailure(taskId, { url, code, message }).pipe(
        Effect.andThen(
          log.error("worker.job.opml_import_feed.failed", {
            taskId,
            userId,
            url,
            error: message,
            code,
          }),
        ),
      );
    }),
  );
});

/** A problem with the uploaded document itself, as opposed to a platform outage. */
const isSourceFailure = (error: unknown): error is PublicError =>
  isApiError(error) && ERROR_CATALOGUE[error._tag].expose;

/**
 * Materializes an accepted import: parse, create folders, store the items, subscribe the feeds we
 * already know, then hand the rest to the dispatcher. A bad document fails the import for good;
 * a platform failure propagates so the queue retries instead of failing an import over an outage.
 */
export const runOpmlImportPrepareJob = Effect.fn("opml.job.import_prepare")(function* (payload: {
  importId: string;
}) {
  const { importId } = payload;
  const log = yield* AppLogger;
  const feeds = yield* OpmlFeeds;
  const claimed = yield* claimOpmlPreparation(importId);
  if (!claimed) {
    yield* log.info("worker.job.opml_import_prepare.duplicate_or_missing", { importId });
    return;
  }

  yield* Effect.gen(function* () {
    const document = yield* parseOpmlDocument(claimed.sourceXml, DEFAULT_FOLDER_NAME);
    const folderMap = yield* feeds.ensureFolders(
      claimed.userId,
      distinctFolderNames(document.feeds),
    );

    yield* insertOpmlImportItems(importId, document.feeds, folderMap);
    yield* recordOpmlImportMaterialized(importId, {
      totalItems: document.feeds.length,
      opmlTitle: document.opmlTitle,
      opmlAuthor: document.opmlAuthor,
    });
    yield* recordOpmlPreparationHeartbeat(importId);

    // Matching only touches items still pending, and nothing inserts new import items after
    // materialization, so one full match up front covers every known feed; re-matching inside
    // the drain loop below would rescan the entire (still large) pending set on every batch.
    yield* matchKnownFeedsForImport(importId);
    while (true) {
      const completion = yield* subscribeKnownOpmlItems(importId, claimed.userId);
      if (completion.refreshCandidateFeedIds.length > 0) {
        yield* publishKnownFeedRefreshCandidates(
          claimed.userId,
          completion.refreshCandidateFeedIds,
        );
      }
      yield* recordOpmlPreparationHeartbeat(importId);
      if (completion.processed === 0) {
        break;
      }
    }

    yield* finalizeOpmlImportPreparation(importId);

    yield* log.info("worker.job.opml_import_prepare.completed", {
      importId,
      totalItems: document.feeds.length,
    });
  }).pipe(
    Effect.catchIf(isSourceFailure, (error) => {
      const code =
        "code" in error && typeof error.code === "string"
          ? error.code
          : ERROR_CATALOGUE[error._tag].code;
      return failOpmlImportPreparation(importId, { code, message: error.message }).pipe(
        Effect.andThen(
          log.error("worker.job.opml_import_prepare.failed", {
            importId,
            error: error.message,
            code,
          }),
        ),
      );
    }),
  );
});

/**
 * Processes one leased unknown-feed import item. A stale/duplicate wakeup (claim fails) or an
 * observed cancellation both return successfully with no counter change and no remote fetch.
 * Retryable failures are persisted durably and this function still returns; only a failure to
 * persist the retry/failure decision itself fails the job (so the queue retries). If the lease
 * is lost while the item runs, the work stops and the new owner's outcome stands.
 */
export const runOpmlImportItemJob = Effect.fn("opml.job.import_item")(function* (payload: {
  importId: string;
  itemId: string;
  leaseToken: string;
}) {
  const { importId, itemId, leaseToken } = payload;
  const log = yield* AppLogger;
  const feeds = yield* OpmlFeeds;
  const claim = yield* claimLeasedOpmlItem(importId, itemId, leaseToken);
  if (!claim) {
    yield* log.info("worker.job.opml_import_item.stale_or_cancelled", { importId, itemId });
    return;
  }

  const options = { folderId: claim.folderId, customTitle: claim.title };
  const importItem = Effect.gen(function* () {
    const result = claim.feedId
      ? yield* feeds.subscribeToKnownFeed(claim.userId, claim.feedId, options)
      : yield* feeds.subscribeToFeedUrl(claim.userId, claim.originalUrl, options);

    if (result.newSubscription) {
      yield* feeds.requestInitialRefresh(result.feedId, claim.userId);
    }

    yield* completeOpmlItem(claim, result.newSubscription ? "subscribed" : "already_subscribed");
    yield* log.info("worker.job.opml_import_item.completed", {
      importId,
      itemId,
      newSubscription: result.newSubscription,
    });
  }).pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        const decision = classifyOpmlItemError(error);
        const now = yield* Clock.currentTimeMillis;
        const jitter = yield* opmlRetryJitter;
        const delayMs = computeOpmlRetryDelayMs(claim.attempts, jitter);
        yield* retryOrFailOpmlItem(claim, decision, new Date(now + delayMs));
        yield* log.error("worker.job.opml_import_item.failed", {
          importId,
          itemId,
          retryable: decision.retryable,
          code: decision.code,
          error: decision.message,
        });
      }),
    ),
  );

  yield* withOpmlItemLeaseHeartbeat(claim, importItem).pipe(
    Effect.catchTag("OpmlLeaseLost", () =>
      log.warn("worker.job.opml_import_item.lease_lost", { importId, itemId }),
    ),
  );
});
