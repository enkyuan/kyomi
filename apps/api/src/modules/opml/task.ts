import { getRedis } from "@adapters/redis";
import { OPML_TASK_TTL_SEC } from "./constants";
import type { OpmlImportCounters, OpmlTaskMeta, OpmlTaskState, OpmlUrlFailure } from "./types";

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

export async function isOpmlTaskCancelled(taskId: string): Promise<boolean> {
  return (await getRedis().exists(opmlTaskCancelKey(taskId))) > 0;
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
