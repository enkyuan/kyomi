import type { Elysia } from "elysia";
import { t } from "elysia";
import { enforceRateLimitForContext } from "@adapters/rate-limit/plugin";
import { AppError } from "@shared/errors/app";
import { v1HandlerContext } from "@shared/http/v1/context";
import { taskIdParam } from "@shared/http/v1/stub";
import { OPML_LEGACY_JSON_MAX_SOURCE_BYTES } from "./constants";
import { exportOpmlForUser } from "./export";
import { fetchOpmlDocumentFromUrl } from "./fetch-url";
import { enqueueOpmlImport } from "./jobs";
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

const opmlImportRateLimit = {
  name: "opml.import",
  max: 5,
  windowMs: 15 * 60_000,
} as const;

const MAX_STATUS_FAILURES = 25;

const failureItem = t.Object({
  url: t.String(),
  code: t.String(),
  message: t.String(),
});

const importSummary = t.Object({
  totalUrls: t.Number(),
  completed: t.Number(),
  subscribed: t.Number(),
  alreadySubscribed: t.Number(),
  failed: t.Number(),
  cancelled: t.Number(),
  failures: t.Array(failureItem),
});

const opmlImportAccepted = t.Object({
  taskId: t.String(),
});

const opmlExportResponse = t.String();

const opmlTaskStatusValue = t.Union([
  t.Literal("pending"),
  t.Literal("in_progress"),
  t.Literal("completed"),
  t.Literal("failed"),
  t.Literal("cancelled"),
]);

const opmlTaskStage = t.Union([
  t.Literal("queued"),
  t.Literal("parsing"),
  t.Literal("dispatching"),
  t.Literal("processing"),
  t.Literal("finalizing"),
]);

const opmlTaskStatus = t.Object({
  taskId: t.String(),
  status: opmlTaskStatusValue,
  createdAt: t.String(),
  completedAt: t.Union([t.String(), t.Null()]),
  filename: t.String(),
  opmlTitle: t.Union([t.String(), t.Null()]),
  opmlAuthor: t.Union([t.String(), t.Null()]),
  message: t.Union([t.String(), t.Null()]),
  summary: importSummary,
});

const opmlActiveSummary = t.Object({
  subscribed: t.Number(),
  alreadySubscribed: t.Number(),
  failed: t.Number(),
  totalUrls: t.Number(),
});

const opmlActiveResponse = t.Object({
  items: t.Array(
    t.Object({
      taskId: t.String(),
      status: opmlTaskStatusValue,
      createdAt: t.String(),
      completedAt: t.Union([t.String(), t.Null()]),
      summary: t.Union([opmlActiveSummary, t.Null()]),
    }),
  ),
});

const opmlImportPageItem = t.Object({
  taskId: t.String(),
  filename: t.Union([t.String(), t.Null()]),
  sourceUrl: t.Union([t.String(), t.Null()]),
  stage: opmlTaskStage,
  status: opmlTaskStatusValue,
  summary: t.Object({
    totalUrls: t.Number(),
    completed: t.Number(),
    subscribed: t.Number(),
    alreadySubscribed: t.Number(),
    failed: t.Number(),
  }),
  createdAt: t.String(),
  updatedAt: t.String(),
  completedAt: t.Union([t.String(), t.Null()]),
  message: t.Union([t.String(), t.Null()]),
});

const opmlImportPageResponse = t.Object({
  items: t.Array(opmlImportPageItem),
  nextCursor: t.Union([t.String(), t.Null()]),
  hasMore: t.Boolean(),
});

const opmlFailurePageItem = t.Object({
  id: t.String(),
  url: t.String(),
  code: t.String(),
  message: t.String(),
  position: t.Number(),
});

const opmlFailurePageResponse = t.Object({
  items: t.Array(opmlFailurePageItem),
  nextCursor: t.Union([t.String(), t.Null()]),
  hasMore: t.Boolean(),
});

const messageResponse = t.Object({
  message: t.String(),
});

const cancelResponse = t.Object({
  taskId: t.String(),
  cancelled: t.Boolean(),
  message: t.String(),
});

function normalizeOpmlFilename(filename: string | undefined): string {
  const trimmed = filename?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "inline.opml";
}

function assertLegacyJsonSourceSize(xml: string): void {
  if (Buffer.byteLength(xml, "utf8") > OPML_LEGACY_JSON_MAX_SOURCE_BYTES) {
    throw new AppError("OPML payload exceeds the JSON import size limit", {
      status: 413,
      code: "OPML_LEGACY_JSON_TOO_LARGE",
      details: { maxBytes: OPML_LEGACY_JSON_MAX_SOURCE_BYTES },
    });
  }
}

function readRequestHeader(context: unknown, name: string): string | undefined {
  const headers = (context as { headers?: Record<string, string | undefined> }).headers;
  return headers?.[name];
}

function mapOpmlImportRowToPageItem(row: Parameters<typeof toCompatibleOpmlImportStatus>[0]) {
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

export function registerOpmlRoutes(app: Elysia) {
  return app
    .post(
      "/opml/imports",
      async (context) => {
        const { db, body, logger, set, userId } = v1HandlerContext<{
          xml: string;
          filename?: string;
        }>(context);
        await enforceRateLimitForContext(context, userId, opmlImportRateLimit);
        if (!body.xml.trim()) {
          throw new AppError("xml is required", { status: 400, code: "OPML_XML_REQUIRED" });
        }
        assertLegacyJsonSourceSize(body.xml);

        const { taskId } = await enqueueOpmlImport(
          db,
          userId,
          body.xml,
          logger,
          normalizeOpmlFilename(body.filename),
        );
        set.status = 202;
        return { taskId };
      },
      {
        body: t.Object({
          xml: t.String({ minLength: 1 }),
          filename: t.Optional(t.String()),
        }),
        response: {
          202: opmlImportAccepted,
        },
      },
    )
    .post(
      "/opml/imports/raw",
      async (context) => {
        const { db, body, logger, set, userId } = v1HandlerContext<string>(context);
        await enforceRateLimitForContext(context, userId, opmlImportRateLimit);
        if (!body.trim()) {
          throw new AppError("xml is required", { status: 400, code: "OPML_XML_REQUIRED" });
        }

        const filenameHeader = readRequestHeader(context, "x-opml-filename");
        const { taskId } = await enqueueOpmlImport(
          db,
          userId,
          body,
          logger,
          normalizeOpmlFilename(filenameHeader),
        );
        set.status = 202;
        return { taskId };
      },
      {
        parse: "text",
        type: "application/xml",
        response: {
          202: opmlImportAccepted,
        },
      },
    )
    .post(
      "/opml/imports/from-url",
      async (context) => {
        const { db, body, logger, set, userId } = v1HandlerContext<{
          url: string;
          filename?: string;
        }>(context);
        await enforceRateLimitForContext(context, userId, opmlImportRateLimit);

        const fetched = await fetchOpmlDocumentFromUrl(body.url);
        const { taskId } = await enqueueOpmlImport(
          db,
          userId,
          fetched.xml,
          logger,
          normalizeOpmlFilename(body.filename ?? fetched.filename),
          fetched.finalUrl,
        );
        set.status = 202;
        return { taskId };
      },
      {
        body: t.Object({
          url: t.String({ minLength: 1 }),
          filename: t.Optional(t.String()),
        }),
        response: {
          202: opmlImportAccepted,
        },
      },
    )
    .get(
      "/opml/export",
      async (context) => {
        const { db, userId } = v1HandlerContext(context);
        const xml = await exportOpmlForUser(db, userId);
        return new Response(xml, {
          status: 200,
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "content-disposition": 'attachment; filename="kyomi-subscriptions.opml"',
          },
        });
      },
      {
        response: {
          200: opmlExportResponse,
        },
      },
    )
    .get(
      "/opml/imports",
      async (context) => {
        const { db, userId, query } = v1HandlerContext<
          unknown,
          { cursor?: string; limit?: string }
        >(context);
        const page = await listOpmlImportsForUser(db, {
          userId,
          cursor: query.cursor,
          limit: query.limit !== undefined ? Number(query.limit) : undefined,
        });
        return {
          items: page.items.map(mapOpmlImportRowToPageItem),
          nextCursor: page.nextCursor,
          hasMore: page.hasMore,
        };
      },
      {
        query: t.Object({
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
        response: {
          200: opmlImportPageResponse,
        },
      },
    )
    .get(
      "/opml/imports/active",
      async (context) => {
        const { db, userId } = v1HandlerContext(context);
        const active = await listActiveOpmlImportsForUser(db, userId);
        return {
          items: active.map((row) => ({
            taskId: row.id,
            status: toCompatibleOpmlImportStatus(row),
            createdAt: row.createdAt.toISOString(),
            completedAt: row.completedAt?.toISOString() ?? null,
            summary: buildOpmlImportSummary(row),
          })),
        };
      },
      {
        response: {
          200: opmlActiveResponse,
        },
      },
    )
    .get(
      "/opml/imports/:taskId/status",
      async (context) => {
        const { db, params, userId } = v1HandlerContext(context);
        const row = await getOpmlImportForUser(db, userId, params.taskId);

        if (!row) {
          throw new AppError("Import task not found", {
            status: 404,
            code: "OPML_TASK_NOT_FOUND",
          });
        }

        const summary = buildOpmlImportSummary(row);
        const failuresPage =
          row.failedItems > 0
            ? await listOpmlImportFailures(db, {
                userId,
                importId: row.id,
                limit: MAX_STATUS_FAILURES,
              })
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
      },
      {
        params: t.Object({ taskId: taskIdParam }),
        response: {
          200: opmlTaskStatus,
        },
      },
    )
    .get(
      "/opml/imports/:taskId/failures",
      async (context) => {
        const { db, params, userId, query } = v1HandlerContext<
          unknown,
          { cursor?: string; limit?: string }
        >(context);
        const page = await listOpmlImportFailures(db, {
          userId,
          importId: params.taskId,
          cursor: query.cursor,
          limit: query.limit !== undefined ? Number(query.limit) : undefined,
        });
        return page;
      },
      {
        params: t.Object({ taskId: taskIdParam }),
        query: t.Object({
          cursor: t.Optional(t.String()),
          limit: t.Optional(t.String()),
        }),
        response: {
          200: opmlFailurePageResponse,
        },
      },
    )
    .delete(
      "/opml/imports/:taskId/cancel",
      async (context) => {
        const { db, params, userId } = v1HandlerContext(context);
        const result = await requestOpmlImportCancellation(db, userId, params.taskId);

        if (!result.found) {
          const owner = await getOpmlImportOwner(db, params.taskId);
          if (!owner || owner !== userId) {
            throw new AppError("Import task not found", {
              status: 404,
              code: "OPML_TASK_NOT_FOUND",
            });
          }
        }

        if (result.cancelled) {
          let cancelledInBatch = await cancelPendingOpmlItems(db, params.taskId, 500);
          while (cancelledInBatch > 0) {
            cancelledInBatch = await cancelPendingOpmlItems(db, params.taskId, 500);
          }
        }

        return {
          taskId: params.taskId,
          cancelled: result.cancelled,
          message: result.cancelled ? "Import cancelled" : `Import is already ${result.status}`,
        };
      },
      {
        params: t.Object({ taskId: taskIdParam }),
        response: {
          200: cancelResponse,
        },
      },
    )
    .delete(
      "/opml/imports/:taskId",
      async (context) => {
        const { db, params, userId } = v1HandlerContext(context);
        const removed = await deleteTerminalOpmlImport(db, userId, params.taskId);
        if (!removed) {
          const row = await getOpmlImportForUser(db, userId, params.taskId);
          if (row) {
            throw new AppError("Active imports must be cancelled before removal", {
              status: 409,
              code: "OPML_TASK_ACTIVE",
            });
          }
          throw new AppError("Import task not found", {
            status: 404,
            code: "OPML_TASK_NOT_FOUND",
          });
        }
        return { message: "Import task removed" };
      },
      {
        params: t.Object({ taskId: taskIdParam }),
        response: {
          200: messageResponse,
        },
      },
    );
}
