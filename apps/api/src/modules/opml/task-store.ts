import { getRedis } from "@adapters/redis";
import { OPML_TASK_TTL_SEC } from "./constants";
import type {
  OpmlImportCounters,
  OpmlImportStatus,
  OpmlTaskListItem,
  OpmlTaskMeta,
  OpmlTaskState,
  OpmlUrlFailure,
} from "./types";

const PREFIX = "kyomi:opml";

function taskBaseKey(taskId: string): string {
  return `${PREFIX}:task:${taskId}`;
}

function opmlTaskMetaKey(taskId: string): string {
  return `${taskBaseKey(taskId)}:meta`;
}

function opmlTaskCountersKey(taskId: string): string {
  return `${taskBaseKey(taskId)}:counters`;
}

function opmlTaskErrorsKey(taskId: string): string {
  return `${taskBaseKey(taskId)}:errors`;
}

function opmlTaskCancelKey(taskId: string): string {
  return `${taskBaseKey(taskId)}:cancel`;
}

function opmlTaskOwnerKey(taskId: string): string {
  return `${PREFIX}:owner:${taskId}`;
}

function opmlUserTasksKey(userId: string): string {
  return `${PREFIX}:user-tasks:${userId}`;
}

function decodeString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("utf8");
  }
  return null;
}

function decodeInteger(value: unknown): number {
  const raw = decodeString(value);
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function updateTaskMeta(
  taskId: string,
  mutate: (meta: OpmlTaskMeta) => OpmlTaskMeta,
): Promise<OpmlTaskMeta | null> {
  const redis = getRedis();
  const metaRaw = await redis.get(opmlTaskMetaKey(taskId));
  if (!metaRaw) {
    return null;
  }

  const next = mutate(JSON.parse(metaRaw) as OpmlTaskMeta);
  await redis.setex(opmlTaskMetaKey(taskId), OPML_TASK_TTL_SEC, JSON.stringify(next));
  return next;
}

async function maybeFinalizeTask(taskId: string, completed: number): Promise<void> {
  const state = await getOpmlTask(taskId);
  if (!state) {
    return;
  }
  if (state.status === "cancelled" || state.status === "failed" || state.status === "completed") {
    return;
  }
  if (completed < state.counters.totalUrls) {
    return;
  }

  const now = new Date().toISOString();
  const messageParts = [
    `${state.counters.subscribed} added`,
    `${state.counters.alreadySubscribed} existed`,
  ];
  if (state.counters.failed > 0) {
    messageParts.push(`${state.counters.failed} failed`);
  }

  await updateTaskMeta(taskId, (meta) => ({
    ...meta,
    status: state.counters.failed === state.counters.totalUrls ? "failed" : "completed",
    completedAt: now,
    message: messageParts.join(". "),
  }));
}

export async function initializeOpmlTask(input: {
  taskId: string;
  userId: string;
  filename: string;
  opmlTitle: string | null;
  opmlAuthor: string | null;
  totalUrls: number;
}): Promise<void> {
  const redis = getRedis();
  const meta: OpmlTaskMeta = {
    taskId: input.taskId,
    userId: input.userId,
    filename: input.filename,
    opmlTitle: input.opmlTitle,
    opmlAuthor: input.opmlAuthor,
    status: "pending",
    createdAt: new Date().toISOString(),
    completedAt: null,
    message: null,
  };

  const counters: OpmlImportCounters = {
    totalUrls: input.totalUrls,
    completed: 0,
    subscribed: 0,
    alreadySubscribed: 0,
    failed: 0,
    cancelled: 0,
  };

  const tx = redis.multi();
  tx.setex(opmlTaskMetaKey(input.taskId), OPML_TASK_TTL_SEC, JSON.stringify(meta));
  tx.hset(opmlTaskCountersKey(input.taskId), {
    totalUrls: String(counters.totalUrls),
    completed: "0",
    subscribed: "0",
    alreadySubscribed: "0",
    failed: "0",
    cancelled: "0",
  });
  tx.expire(opmlTaskCountersKey(input.taskId), OPML_TASK_TTL_SEC);
  tx.setex(opmlTaskOwnerKey(input.taskId), OPML_TASK_TTL_SEC, input.userId);
  tx.sadd(opmlUserTasksKey(input.userId), input.taskId);
  tx.expire(opmlUserTasksKey(input.userId), OPML_TASK_TTL_SEC);
  await tx.exec();
}

export async function markOpmlTaskInProgress(taskId: string): Promise<void> {
  await updateTaskMeta(taskId, (meta) =>
    meta.status === "pending" ? { ...meta, status: "in_progress" } : meta,
  );
}

export async function getOpmlTask(taskId: string): Promise<OpmlTaskState | null> {
  const redis = getRedis();
  const execResult = await redis
    .multi()
    .get(opmlTaskMetaKey(taskId))
    .hgetall(opmlTaskCountersKey(taskId))
    .lrange(opmlTaskErrorsKey(taskId), 0, -1)
    .exec();
  const [metaRaw, countersRaw, failuresRaw] = (execResult ?? []).map((entry) => entry?.[1] ?? null);

  if (!metaRaw) {
    return null;
  }

  const meta = JSON.parse(metaRaw as string) as OpmlTaskMeta;
  const countersRecord = (countersRaw ?? {}) as Record<string, unknown>;
  const counters: OpmlImportCounters = {
    totalUrls: decodeInteger(countersRecord.totalUrls),
    completed: decodeInteger(countersRecord.completed),
    subscribed: decodeInteger(countersRecord.subscribed),
    alreadySubscribed: decodeInteger(countersRecord.alreadySubscribed),
    failed: decodeInteger(countersRecord.failed),
    cancelled: decodeInteger(countersRecord.cancelled),
  };
  const failures = Array.isArray(failuresRaw)
    ? failuresRaw
        .map((entry) => decodeString(entry))
        .filter((entry): entry is string => Boolean(entry))
        .map((entry) => JSON.parse(entry) as OpmlUrlFailure)
    : [];

  return {
    ...meta,
    counters,
    failures,
  };
}

export async function getOpmlTaskOwner(taskId: string): Promise<string | null> {
  const owner = await getRedis().get(opmlTaskOwnerKey(taskId));
  return decodeString(owner);
}

export async function isOpmlTaskCancelled(taskId: string): Promise<boolean> {
  return (await getRedis().exists(opmlTaskCancelKey(taskId))) > 0;
}

export async function cancelOpmlTask(taskId: string): Promise<void> {
  const redis = getRedis();
  const now = new Date().toISOString();
  await redis.setex(opmlTaskCancelKey(taskId), OPML_TASK_TTL_SEC, "1");
  await updateTaskMeta(taskId, (meta) => {
    if (meta.status === "completed" || meta.status === "failed" || meta.status === "cancelled") {
      return meta;
    }
    return {
      ...meta,
      status: "cancelled",
      completedAt: now,
      message: "Import cancelled",
    };
  });
}

export async function recordOpmlTaskSuccess(
  taskId: string,
  options: { alreadySubscribed: boolean },
): Promise<void> {
  const redis = getRedis();
  const tx = redis.multi();
  tx.hincrby(
    opmlTaskCountersKey(taskId),
    options.alreadySubscribed ? "alreadySubscribed" : "subscribed",
    1,
  );
  tx.hincrby(opmlTaskCountersKey(taskId), "completed", 1);
  tx.expire(opmlTaskCountersKey(taskId), OPML_TASK_TTL_SEC);
  const result = await tx.exec();
  const completed = decodeInteger(result?.[1]?.[1]);
  await maybeFinalizeTask(taskId, completed);
}

export async function recordOpmlTaskFailure(
  taskId: string,
  failure: OpmlUrlFailure,
): Promise<void> {
  const redis = getRedis();
  const tx = redis.multi();
  tx.hincrby(opmlTaskCountersKey(taskId), "failed", 1);
  tx.hincrby(opmlTaskCountersKey(taskId), "completed", 1);
  tx.rpush(opmlTaskErrorsKey(taskId), JSON.stringify(failure));
  tx.expire(opmlTaskCountersKey(taskId), OPML_TASK_TTL_SEC);
  tx.expire(opmlTaskErrorsKey(taskId), OPML_TASK_TTL_SEC);
  const result = await tx.exec();
  const completed = decodeInteger(result?.[1]?.[1]);
  await maybeFinalizeTask(taskId, completed);
}

export async function failOpmlTask(taskId: string, message: string): Promise<void> {
  await updateTaskMeta(taskId, (meta) => ({
    ...meta,
    status: "failed",
    completedAt: new Date().toISOString(),
    message,
  }));
}

export async function deleteOpmlTask(userId: string, taskId: string): Promise<boolean> {
  const owner = await getOpmlTaskOwner(taskId);
  if (!owner || owner !== userId) {
    return false;
  }

  const redis = getRedis();
  const tx = redis.multi();
  tx.del(opmlTaskMetaKey(taskId));
  tx.del(opmlTaskCountersKey(taskId));
  tx.del(opmlTaskErrorsKey(taskId));
  tx.del(opmlTaskCancelKey(taskId));
  tx.del(opmlTaskOwnerKey(taskId));
  tx.srem(opmlUserTasksKey(userId), taskId);
  await tx.exec();
  return true;
}

export async function listOpmlTasksForUser(userId: string): Promise<OpmlTaskListItem[]> {
  const redis = getRedis();
  const ids = await redis.smembers(opmlUserTasksKey(userId));
  const items: OpmlTaskListItem[] = [];

  for (const taskId of ids) {
    const state = await getOpmlTask(taskId);
    if (!state) {
      if (!(await getOpmlTaskOwner(taskId))) {
        await redis.srem(opmlUserTasksKey(userId), taskId);
      }
      continue;
    }

    items.push({
      taskId,
      status: state.status,
      createdAt: state.createdAt,
      completedAt: state.completedAt,
      summary: {
        subscribed: state.counters.subscribed,
        alreadySubscribed: state.counters.alreadySubscribed,
        failed: state.counters.failed,
        totalUrls: state.counters.totalUrls,
      },
    });
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items;
}

export async function listActiveOpmlTasksForUser(userId: string): Promise<OpmlTaskListItem[]> {
  const items = await listOpmlTasksForUser(userId);
  return items
    .filter((item) => item.status === "pending" || item.status === "in_progress")
    .slice(0, 1);
}

export function buildOpmlSummary(state: OpmlTaskState) {
  return {
    totalUrls: state.counters.totalUrls,
    completed: state.counters.completed,
    subscribed: state.counters.subscribed,
    alreadySubscribed: state.counters.alreadySubscribed,
    failed: state.counters.failed,
    cancelled: state.counters.cancelled,
    failures: state.failures,
  };
}

export function isTerminalOpmlStatus(status: OpmlImportStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}
