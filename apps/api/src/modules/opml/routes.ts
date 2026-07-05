import type { Elysia } from "elysia";
import { t } from "elysia";
import { enforceRateLimitForContext } from "@adapters/rate-limit/plugin";
import { AppError } from "@shared/errors/app";
import { v1HandlerContext } from "@shared/http/v1/context";
import { taskIdParam } from "@shared/http/v1/stub";
import { exportOpmlForUser } from "./export";
import { fetchOpmlDocumentFromUrl } from "./fetch-url";
import { enqueueOpmlImport } from "./jobs";
import {
  buildOpmlSummary,
  cancelOpmlTask,
  deleteOpmlTask,
  getOpmlTask,
  getOpmlTaskOwner,
  isTerminalOpmlStatus,
  listActiveOpmlTasksForUser,
} from "./task-store";

const opmlImportRateLimit = {
  name: "opml.import",
  max: 5,
  windowMs: 15 * 60_000,
} as const;

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

export function registerOpmlRoutes(app: Elysia) {
  return app
    .post(
      "/opml/imports",
      async (context) => {
        const { body, logger, set, userId } = v1HandlerContext<{
          xml: string;
          filename?: string;
        }>(context);
        await enforceRateLimitForContext(context, userId, opmlImportRateLimit);
        if (!body.xml.trim()) {
          throw new AppError("xml is required", { status: 400, code: "OPML_XML_REQUIRED" });
        }

        const { taskId } = await enqueueOpmlImport(
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
      "/opml/imports/from-url",
      async (context) => {
        const { body, logger, set, userId } = v1HandlerContext<{
          url: string;
          filename?: string;
        }>(context);
        await enforceRateLimitForContext(context, userId, opmlImportRateLimit);

        const fetched = await fetchOpmlDocumentFromUrl(body.url);
        const { taskId } = await enqueueOpmlImport(
          userId,
          fetched.xml,
          logger,
          normalizeOpmlFilename(body.filename ?? fetched.filename),
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
      "/opml/imports/active",
      async (context) => {
        const { userId } = v1HandlerContext(context);
        return { items: await listActiveOpmlTasksForUser(userId) };
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
        const { params, userId } = v1HandlerContext(context);
        const state = await getOpmlTask(params.taskId);

        if (!state) {
          const owner = await getOpmlTaskOwner(params.taskId);
          if (!owner || owner !== userId) {
            throw new AppError("Import task not found", {
              status: 404,
              code: "OPML_TASK_NOT_FOUND",
            });
          }
          throw new AppError("Import task state is unavailable", {
            status: 503,
            code: "OPML_TASK_STATE_UNAVAILABLE",
          });
        }
        if (state.userId !== userId) {
          throw new AppError("Import task not found", {
            status: 404,
            code: "OPML_TASK_NOT_FOUND",
          });
        }

        return {
          taskId: params.taskId,
          status: state.status,
          createdAt: state.createdAt,
          completedAt: state.completedAt,
          filename: state.filename,
          opmlTitle: state.opmlTitle,
          opmlAuthor: state.opmlAuthor,
          message: state.message,
          summary: buildOpmlSummary(state),
        };
      },
      {
        params: t.Object({ taskId: taskIdParam }),
        response: {
          200: opmlTaskStatus,
        },
      },
    )
    .delete(
      "/opml/imports/:taskId/cancel",
      async (context) => {
        const { params, userId } = v1HandlerContext(context);
        const state = await getOpmlTask(params.taskId);
        if (!state) {
          const owner = await getOpmlTaskOwner(params.taskId);
          if (!owner || owner !== userId) {
            throw new AppError("Import task not found", {
              status: 404,
              code: "OPML_TASK_NOT_FOUND",
            });
          }
          await cancelOpmlTask(params.taskId);
          return { taskId: params.taskId, cancelled: true, message: "Import cancelled" };
        }
        if (state.userId !== userId) {
          throw new AppError("Import task not found", {
            status: 404,
            code: "OPML_TASK_NOT_FOUND",
          });
        }
        if (isTerminalOpmlStatus(state.status)) {
          return {
            taskId: params.taskId,
            cancelled: false,
            message: `Import is already ${state.status}`,
          };
        }
        await cancelOpmlTask(params.taskId);
        return { taskId: params.taskId, cancelled: true, message: "Import cancelled" };
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
        const { params, userId } = v1HandlerContext(context);
        const state = await getOpmlTask(params.taskId);
        if (state && !isTerminalOpmlStatus(state.status)) {
          throw new AppError("Active imports must be cancelled before removal", {
            status: 409,
            code: "OPML_TASK_ACTIVE",
          });
        }
        const removed = await deleteOpmlTask(userId, params.taskId);
        if (!removed) {
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
