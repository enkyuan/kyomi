import { t } from "elysia";

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

export const opmlImportAccepted = t.Object({
  taskId: t.String(),
});

export const opmlExportResponse = t.String();

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

export const opmlTaskStatus = t.Object({
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

export const opmlActiveResponse = t.Object({
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

export const opmlImportPageResponse = t.Object({
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

export const opmlFailurePageResponse = t.Object({
  items: t.Array(opmlFailurePageItem),
  nextCursor: t.Union([t.String(), t.Null()]),
  hasMore: t.Boolean(),
});

export const messageResponse = t.Object({
  message: t.String(),
});

export const cancelResponse = t.Object({
  taskId: t.String(),
  cancelled: t.Boolean(),
  message: t.String(),
});
