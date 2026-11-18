import { Effect } from "effect";
import type { HttpClient } from "effect/http";
import type { Db } from "@adapters/db/service";
import type { AppLogger } from "@adapters/logger/service";
import type { JobQueue } from "@adapters/queue/service";
import { BadRequest, Conflict, NotFound, PayloadTooLarge } from "@shared/effect/errors";
import { CurrentUser } from "@shared/effect/request";
import { OPML_LEGACY_JSON_MAX_SOURCE_BYTES } from "./constants";
import { exportOpmlForUser } from "./export";
import { fetchOpmlDocumentFromUrl } from "./fetch";
import { enqueueOpmlImport } from "./enqueue";
import {
  buildOpmlImportSummary,
  cancelPendingOpmlItems,
  deleteTerminalOpmlImport,
  getOpmlImportForUser,
  getOpmlImportOwner,
  listActiveOpmlImportsForUser,
  listOpmlImportFailures,
  listOpmlImportsForUser,
  opmlImportStatusMessage,
  requestOpmlImportCancellation,
  toCompatibleOpmlImportStatus,
  toOpmlImportStage,
} from "./store";

/** What the OPML HTTP operations need from the runtime (plus `CurrentUser` per request). */
export type OpmlRouteServices = Db | AppLogger | JobQueue | HttpClient.HttpClient;

const MAX_STATUS_FAILURES = 25;
const CANCEL_BATCH_SIZE = 500;

type PageQuery = { cursor?: string; limit?: string };

const pageArgs = (query: PageQuery) => ({
  cursor: query.cursor,
  limit: query.limit !== undefined ? Number(query.limit) : undefined,
});

const taskNotFound = () =>
  new NotFound({ message: "Import task not found", code: "OPML_TASK_NOT_FOUND" });

const xmlRequired = () => new BadRequest({ message: "xml is required", code: "OPML_XML_REQUIRED" });

function normalizeOpmlFilename(filename: string | undefined): string {
  const trimmed = filename?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "inline.opml";
}

/** `POST /opml/imports`: the legacy JSON body, which carries a smaller source ceiling. */
export const importOpmlFromJson = Effect.fn("opml.http.import_json")(function* (body: {
  xml: string;
  filename?: string;
}) {
  const { userId } = yield* CurrentUser;
  if (!body.xml.trim()) {
    return yield* xmlRequired();
  }
  if (Buffer.byteLength(body.xml, "utf8") > OPML_LEGACY_JSON_MAX_SOURCE_BYTES) {
    return yield* new PayloadTooLarge({
      message: "OPML payload exceeds the JSON import size limit",
      code: "OPML_LEGACY_JSON_TOO_LARGE",
      details: { maxBytes: OPML_LEGACY_JSON_MAX_SOURCE_BYTES },
    });
  }
  return yield* enqueueOpmlImport({
    userId,
    xml: body.xml,
    filename: normalizeOpmlFilename(body.filename),
  });
});

/** `POST /opml/imports/raw`: the XML as the request body, its filename in a header. */
export const importOpmlFromRaw = Effect.fn("opml.http.import_raw")(function* (
  xml: string,
  filename: string | undefined,
) {
  const { userId } = yield* CurrentUser;
  if (!xml.trim()) {
    return yield* xmlRequired();
  }
  return yield* enqueueOpmlImport({ userId, xml, filename: normalizeOpmlFilename(filename) });
});

/** `POST /opml/imports/from-url`: download the document first, then import it. */
export const importOpmlFromUrl = Effect.fn("opml.http.import_url")(function* (body: {
  url: string;
  filename?: string;
}) {
  const { userId } = yield* CurrentUser;
  const fetched = yield* fetchOpmlDocumentFromUrl(body.url);
  return yield* enqueueOpmlImport({
    userId,
    xml: fetched.xml,
    filename: normalizeOpmlFilename(body.filename ?? fetched.filename),
    sourceUrl: fetched.finalUrl,
  });
});

/** `GET /opml/export`: the OPML document for the user's subscriptions. */
export const exportOpml = Effect.gen(function* () {
  const { userId } = yield* CurrentUser;
  return yield* exportOpmlForUser(userId);
});

function toPageItem(row: Parameters<typeof toCompatibleOpmlImportStatus>[0]) {
  const summary = buildOpmlImportSummary(row);
  return {
    taskId: row.id,
    filename: row.filename,
    sourceUrl: row.sourceUrl,
    stage: toOpmlImportStage(row),
    status: toCompatibleOpmlImportStatus(row),
    summary: {
      totalUrls: summary.totalUrls,
      completed: summary.completed,
      subscribed: summary.subscribed,
      alreadySubscribed: summary.alreadySubscribed,
      failed: summary.failed,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    message: opmlImportStatusMessage(row),
  };
}

/** `GET /opml/imports`: the user's import history, newest first. */
export const listImports = Effect.fn("opml.http.list_imports")(function* (query: PageQuery) {
  const { userId } = yield* CurrentUser;
  const page = yield* listOpmlImportsForUser({ userId, ...pageArgs(query) });
  return {
    items: page.items.map(toPageItem),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
});

/** `GET /opml/imports/active`: the user's in-flight import, if any. */
export const listActiveImports = Effect.gen(function* () {
  const { userId } = yield* CurrentUser;
  const active = yield* listActiveOpmlImportsForUser(userId);
  return {
    items: active.map((row) => ({
      taskId: row.id,
      status: toCompatibleOpmlImportStatus(row),
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt?.toISOString() ?? null,
      summary: buildOpmlImportSummary(row),
    })),
  };
});

/** `GET /opml/imports/:taskId/status`: counters plus the first failures. */
export const getImportStatus = Effect.fn("opml.http.import_status")(function* (taskId: string) {
  const { userId } = yield* CurrentUser;
  const row = yield* getOpmlImportForUser(userId, taskId);
  if (!row) {
    return yield* taskNotFound();
  }

  const summary = buildOpmlImportSummary(row);
  const failuresPage =
    row.failedItems > 0
      ? yield* listOpmlImportFailures({ userId, importId: row.id, limit: MAX_STATUS_FAILURES })
      : null;
  return {
    taskId: row.id,
    status: toCompatibleOpmlImportStatus(row),
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    filename: row.filename,
    opmlTitle: row.opmlTitle,
    opmlAuthor: row.opmlAuthor,
    message: opmlImportStatusMessage(row),
    summary: {
      ...summary,
      failures: (failuresPage?.items ?? []).map((failure) => ({
        url: failure.url,
        code: failure.code,
        message: failure.message,
      })),
    },
  };
});

/** `GET /opml/imports/:taskId/failures`: one page of failed URLs. */
export const listImportFailures = Effect.fn("opml.http.import_failures")(function* (
  taskId: string,
  query: PageQuery,
) {
  const { userId } = yield* CurrentUser;
  return yield* listOpmlImportFailures({ userId, importId: taskId, ...pageArgs(query) });
});

/** `DELETE /opml/imports/:taskId/cancel`: request cancellation, then drain the pending items. */
export const cancelImport = Effect.fn("opml.http.cancel_import")(function* (taskId: string) {
  const { userId } = yield* CurrentUser;
  const result = yield* requestOpmlImportCancellation(userId, taskId);

  if (!result.found) {
    const owner = yield* getOpmlImportOwner(taskId);
    if (!owner || owner !== userId) {
      return yield* taskNotFound();
    }
  }

  if (result.cancelled) {
    let cancelledInBatch = yield* cancelPendingOpmlItems(taskId, CANCEL_BATCH_SIZE);
    while (cancelledInBatch > 0) {
      cancelledInBatch = yield* cancelPendingOpmlItems(taskId, CANCEL_BATCH_SIZE);
    }
  }

  return {
    taskId,
    cancelled: result.cancelled,
    message: result.cancelled ? "Import cancelled" : `Import is already ${result.status}`,
  };
});

/** `DELETE /opml/imports/:taskId`: remove a finished import. */
export const removeImport = Effect.fn("opml.http.remove_import")(function* (taskId: string) {
  const { userId } = yield* CurrentUser;
  const removed = yield* deleteTerminalOpmlImport(userId, taskId);
  if (!removed) {
    const row = yield* getOpmlImportForUser(userId, taskId);
    if (row) {
      return yield* new Conflict({
        message: "Active imports must be cancelled before removal",
        code: "OPML_TASK_ACTIVE",
      });
    }
    return yield* taskNotFound();
  }
  return { message: "Import task removed" };
});
