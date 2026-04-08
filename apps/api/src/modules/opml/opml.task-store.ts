import { getRedis } from "@adapters/redis";
import { OPML_TASK_TTL_SEC } from "./opml.constants";
import type { OpmlTaskPayload } from "./opml.types";

const PREFIX = "cronos:opml:";

export function opmlTaskKey(taskId: string): string {
  return `${PREFIX}task:${taskId}`;
}

export function opmlUserTasksKey(userId: string): string {
  return `${PREFIX}user-tasks:${userId}`;
}

export async function saveOpmlTask(taskId: string, payload: OpmlTaskPayload): Promise<void> {
  const redis = getRedis();
  const userKey = opmlUserTasksKey(payload.userId);
  await redis.setex(opmlTaskKey(taskId), OPML_TASK_TTL_SEC, JSON.stringify(payload));
  await redis.sadd(userKey, taskId);
  await redis.expire(userKey, OPML_TASK_TTL_SEC);
}

export async function getOpmlTask(taskId: string): Promise<OpmlTaskPayload | null> {
  const raw = await getRedis().get(opmlTaskKey(taskId));
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as OpmlTaskPayload;
}

export async function deleteOpmlTask(userId: string, taskId: string): Promise<boolean> {
  const redis = getRedis();
  const payload = await getOpmlTask(taskId);
  if (!payload || payload.userId !== userId) {
    return false;
  }
  await redis.del(opmlTaskKey(taskId));
  await redis.srem(opmlUserTasksKey(userId), taskId);
  return true;
}

export type OpmlTaskListItem = {
  taskId: string;
  status: OpmlTaskPayload["status"];
  createdAt: string;
  completedAt: string;
  summary: Pick<
    OpmlTaskPayload["summary"],
    "subscribed" | "alreadySubscribed" | "failed" | "totalUrls"
  >;
};

export async function listOpmlTasksForUser(userId: string): Promise<OpmlTaskListItem[]> {
  const redis = getRedis();
  const userKey = opmlUserTasksKey(userId);
  const ids = await redis.smembers(userKey);
  const items: OpmlTaskListItem[] = [];

  for (const id of ids) {
    const record = await getOpmlTask(id);
    if (!record) {
      await redis.srem(userKey, id);
      continue;
    }
    items.push({
      taskId: id,
      status: record.status,
      createdAt: record.createdAt,
      completedAt: record.completedAt,
      summary: {
        subscribed: record.summary.subscribed,
        alreadySubscribed: record.summary.alreadySubscribed,
        failed: record.summary.failed,
        totalUrls: record.summary.totalUrls,
      },
    });
  }

  return items;
}
