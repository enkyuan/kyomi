import { DateTime, Effect } from "effect";
import type { ChainableCommander } from "ioredis";
import { Redis } from "@adapters/redis/service";
import { RedisError } from "@shared/effect/errors";
import { OPML_TASK_TTL_SEC } from "./constants";
import type {
  OpmlImportCounters,
  OpmlImportStatus,
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
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const raw = decodeString(value);
  if (!raw) {
    return 0;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Stored task JSON that no longer parses is a Redis data failure, not a bug in the caller. */
const parseStored = <T>(operation: string, raw: string) =>
  Effect.try({
    try: () => JSON.parse(raw) as T,
    catch: (cause) => new RedisError({ operation, cause }),
  });

/** Run a MULTI/EXEC and return each command's value; an aborted or partly failed one throws. */
async function execute(tx: ChainableCommander): Promise<unknown[]> {
  const results = await tx.exec();
  if (!results) {
    throw new Error("Redis transaction was aborted");
  }
  return results.map(([error, value]) => {
    if (error) {
      throw error;
    }
    return value;
  });
}

/**
 * Merges `patch` into the stored meta in one atomic step. Doing the read-modify-write in Lua
 * means concurrent workers recording results cannot overwrite each other's update. With a
 * non-empty status list the patch applies only while the task is in one of those statuses.
 * Returns 1 when applied and 0 when the task is missing or in another status.
 */
const PATCH_META_SCRIPT = `
local raw = redis.call("GET", KEYS[1])
if not raw then return 0 end
local meta = cjson.decode(raw)
local allowed = cjson.decode(ARGV[3])
if #allowed > 0 then
  local matches = false
  for _, status in ipairs(allowed) do
    if meta.status == status then matches = true end
  end
  if not matches then return 0 end
end
for key, value in pairs(cjson.decode(ARGV[2])) do meta[key] = value end
redis.call("SETEX", KEYS[1], ARGV[1], cjson.encode(meta))
return 1
`;

const patchTaskMeta = Effect.fn("opml.task.patch_meta")(function* (
  taskId: string,
  patch: Partial<Pick<OpmlTaskMeta, "status" | "completedAt" | "message">>,
  onlyWhenStatus: OpmlImportStatus[] = [],
) {
  const redis = yield* Redis;
  const applied = yield* redis.use("opml.task.patch_meta", (client) =>
    client.eval(
      PATCH_META_SCRIPT,
      1,
      opmlTaskMetaKey(taskId),
      String(OPML_TASK_TTL_SEC),
      JSON.stringify(patch),
      JSON.stringify(onlyWhenStatus),
    ),
  );
  return applied === 1;
});

export const markOpmlTaskInProgress = Effect.fn("opml.task.mark_in_progress")(function* (
  taskId: string,
) {
  yield* patchTaskMeta(taskId, { status: "in_progress" }, ["pending"]);
});

export const getOpmlTask = Effect.fn("opml.task.get")(function* (taskId: string) {
  const redis = yield* Redis;
  const [metaRaw, countersRaw, failuresRaw] = yield* redis.use("opml.task.get", (client) =>
    execute(
      client
        .multi()
        .get(opmlTaskMetaKey(taskId))
        .hgetall(opmlTaskCountersKey(taskId))
        .lrange(opmlTaskErrorsKey(taskId), 0, -1),
    ),
  );

  if (!metaRaw) {
    return null;
  }

  const meta = yield* parseStored<OpmlTaskMeta>("opml.task.parse_meta", metaRaw as string);
  const countersRecord = (countersRaw ?? {}) as Record<string, unknown>;
  const counters: OpmlImportCounters = {
    totalUrls: decodeInteger(countersRecord.totalUrls),
    completed: decodeInteger(countersRecord.completed),
    subscribed: decodeInteger(countersRecord.subscribed),
    alreadySubscribed: decodeInteger(countersRecord.alreadySubscribed),
    failed: decodeInteger(countersRecord.failed),
    cancelled: decodeInteger(countersRecord.cancelled),
  };
  const failures = yield* Effect.forEach(
    Array.isArray(failuresRaw)
      ? failuresRaw
          .map((entry) => decodeString(entry))
          .filter((entry): entry is string => Boolean(entry))
      : [],
    (entry) => parseStored<OpmlUrlFailure>("opml.task.parse_failure", entry),
  );

  const state: OpmlTaskState = { ...meta, counters, failures };
  return state;
});

const maybeFinalizeTask = Effect.fn("opml.task.maybe_finalize")(function* (
  taskId: string,
  completed: number,
) {
  const state = yield* getOpmlTask(taskId);
  if (!state) {
    return;
  }
  if (state.status === "cancelled" || state.status === "failed" || state.status === "completed") {
    return;
  }
  if (completed < state.counters.totalUrls) {
    return;
  }

  const now = yield* DateTime.nowAsDate;
  const messageParts = [
    `${state.counters.subscribed} added`,
    `${state.counters.alreadySubscribed} existed`,
  ];
  if (state.counters.failed > 0) {
    messageParts.push(`${state.counters.failed} failed`);
  }

  yield* patchTaskMeta(
    taskId,
    {
      status: state.counters.failed === state.counters.totalUrls ? "failed" : "completed",
      completedAt: now.toISOString(),
      message: messageParts.join(". "),
    },
    ["pending", "in_progress"],
  );
});

export const isOpmlTaskCancelled = Effect.fn("opml.task.is_cancelled")(function* (taskId: string) {
  const redis = yield* Redis;
  const found = yield* redis.use("opml.task.exists", (client) =>
    client.exists(opmlTaskCancelKey(taskId)),
  );
  return found > 0;
});

export const recordOpmlTaskSuccess = Effect.fn("opml.task.record_success")(function* (
  taskId: string,
  options: { alreadySubscribed: boolean },
) {
  const redis = yield* Redis;
  const results = yield* redis.use("opml.task.record_success", (client) =>
    execute(
      client
        .multi()
        .hincrby(
          opmlTaskCountersKey(taskId),
          options.alreadySubscribed ? "alreadySubscribed" : "subscribed",
          1,
        )
        .hincrby(opmlTaskCountersKey(taskId), "completed", 1)
        .expire(opmlTaskCountersKey(taskId), OPML_TASK_TTL_SEC),
    ),
  );
  yield* maybeFinalizeTask(taskId, decodeInteger(results[1]));
});

export const recordOpmlTaskFailure = Effect.fn("opml.task.record_failure")(function* (
  taskId: string,
  failure: OpmlUrlFailure,
) {
  const redis = yield* Redis;
  const results = yield* redis.use("opml.task.record_failure", (client) =>
    execute(
      client
        .multi()
        .hincrby(opmlTaskCountersKey(taskId), "failed", 1)
        .hincrby(opmlTaskCountersKey(taskId), "completed", 1)
        .rpush(opmlTaskErrorsKey(taskId), JSON.stringify(failure))
        .expire(opmlTaskCountersKey(taskId), OPML_TASK_TTL_SEC)
        .expire(opmlTaskErrorsKey(taskId), OPML_TASK_TTL_SEC),
    ),
  );
  yield* maybeFinalizeTask(taskId, decodeInteger(results[1]));
});

export const failOpmlTask = Effect.fn("opml.task.fail")(function* (
  taskId: string,
  message: string,
) {
  const now = yield* DateTime.nowAsDate;
  yield* patchTaskMeta(taskId, {
    status: "failed",
    completedAt: now.toISOString(),
    message,
  });
});
