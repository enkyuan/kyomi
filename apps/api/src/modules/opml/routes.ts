import type { Elysia } from "elysia";
import { t } from "elysia";
import { enforceRateLimitForContext } from "@adapters/rate-limit/rate-limit.plugin";
import { AppError } from "@shared/errors/app-error";
import { v1HandlerContext } from "@shared/http/v1-handler-context";
import { taskIdParam, uuidParam } from "@shared/http/v1-stub";
import { importOpmlFeedUrls } from "./import-feeds";
import { parseOpmlFeeds } from "./parse";
import { deleteOpmlTask, getOpmlTask, listOpmlTasksForUser, saveOpmlTask } from "./task-store";

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
  subscribed: t.Number(),
  alreadySubscribed: t.Number(),
  failed: t.Number(),
  failures: t.Array(failureItem),
  totalUrls: t.Number(),
});

const opmlImportAccepted = t.Object({
  taskId: uuidParam,
});

const opmlTaskStatusValue = t.Union([
  t.Literal("pending"),
  t.Literal("completed"),
  t.Literal("failed"),
]);

const opmlTaskSummary = t.Union([importSummary, t.Null()]);

const opmlTaskStatus = t.Object({
  taskId: t.String(),
  status: opmlTaskStatusValue,
  createdAt: t.String(),
  completedAt: t.Union([t.String(), t.Null()]),
  summary: opmlTaskSummary,
});

const opmlActiveSummary = t.Union([
  t.Object({
    subscribed: t.Number(),
    alreadySubscribed: t.Number(),
    failed: t.Number(),
    totalUrls: t.Number(),
  }),
  t.Null(),
]);

const opmlActiveResponse = t.Object({
  items: t.Array(
    t.Object({
      taskId: t.String(),
      status: opmlTaskStatusValue,
      createdAt: t.String(),
      completedAt: t.Union([t.String(), t.Null()]),
      summary: opmlActiveSummary,
    }),
  ),
});

const messageResponse = t.Object({
  message: t.String(),
});

export function registerOpmlRoutes(app: Elysia) {
  return app
    .post(
      "/opml/imports",
      async (context) => {
        const { body, db, logger, set, userId } = v1HandlerContext<{ xml: string }>(context);
        await enforceRateLimitForContext(context, userId, opmlImportRateLimit);
        if (!body.xml.trim()) {
          throw new AppError("xml is required", { status: 400, code: "OPML_XML_REQUIRED" });
        }

        const taskId = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        const urls = parseOpmlFeeds(body.xml);
        const baseSummary = {
          subscribed: 0,
          alreadySubscribed: 0,
          failed: 0,
          failures: [] as Array<{ url: string; code: string; message: string }>,
          totalUrls: urls.length,
        };

        try {
          await saveOpmlTask(taskId, {
            userId,
            status: "pending",
            createdAt,
            completedAt: null,
            summary: baseSummary,
          });
        } catch (error) {
          logger.error("opml.import.task_store_failed", {
            userId,
            taskId,
            error: error instanceof Error ? error.message : String(error),
          });
          throw new AppError("Failed to start OPML import", {
            status: 503,
            code: "OPML_TASK_STORE_UNAVAILABLE",
          });
        }
        logger.info("opml.import.started", { userId, taskId, urlCount: urls.length });

        // Run the import in the background
        void (async () => {
          try {
            const summary = await importOpmlFeedUrls(db, userId, urls);
            const completedAt = new Date().toISOString();

            await saveOpmlTask(taskId, {
              userId,
              status: "completed",
              createdAt,
              completedAt,
              summary,
            });

            logger.info("opml.import.completed", {
              userId,
              taskId,
              subscribed: summary.subscribed,
              alreadySubscribed: summary.alreadySubscribed,
              failed: summary.failed,
            });
          } catch (error) {
            const completedAt = new Date().toISOString();
            const message = error instanceof Error ? error.message : String(error);
            const summary = {
              ...baseSummary,
              failed: baseSummary.totalUrls,
              failures: baseSummary.totalUrls
                ? [
                    {
                      url: "OPML_IMPORT",
                      code: "OPML_IMPORT_FAILED",
                      message,
                    },
                  ]
                : [],
            };

            try {
              await saveOpmlTask(taskId, {
                userId,
                status: "failed",
                createdAt,
                completedAt,
                summary,
              });
            } catch (saveError) {
              logger.error("opml.import.task_store_failed", {
                userId,
                taskId,
                error: saveError instanceof Error ? saveError.message : String(saveError),
              });
            }

            logger.error("opml.import.failed", {
              userId,
              taskId,
              error: message,
            });
          }
        })();

        set.status = 202;
        return { taskId };
      },
      {
        body: t.Object({
          xml: t.String({ minLength: 1 }),
        }),
        response: {
          202: opmlImportAccepted,
        },
      },
    )
    .get(
      "/opml/imports/active",
      async (context) => {
        const { userId } = v1HandlerContext(context);
        const items = await listOpmlTasksForUser(userId);
        items.sort((a, b) => {
          const aTime = new Date(a.completedAt ?? a.createdAt).getTime();
          const bTime = new Date(b.completedAt ?? b.createdAt).getTime();
          return aTime < bTime ? 1 : -1;
        });
        return { items };
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
        const record = await getOpmlTask(params.taskId);
        if (!record || record.userId !== userId) {
          throw new AppError("Import task not found", {
            status: 404,
            code: "OPML_TASK_NOT_FOUND",
          });
        }
        return {
          taskId: params.taskId,
          status: record.status,
          createdAt: record.createdAt,
          completedAt: record.completedAt,
          summary: record.summary,
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
      "/opml/imports/:taskId",
      async (context) => {
        const { params, userId } = v1HandlerContext(context);
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
