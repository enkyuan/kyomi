import { describe, expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { TestClock } from "effect/testing";
import {
  failOpmlTask,
  getOpmlTask,
  isOpmlTaskCancelled,
  markOpmlTaskInProgress,
  recordOpmlTaskFailure,
  recordOpmlTaskSuccess,
} from "@modules/opml/task";
import { fakeRedis } from "@api-tests/support/layers";
import { failureWith, runWith } from "./fixtures";

const META_KEY = "kyomi:opml:task:task-1:meta";

/**
 * A fake ioredis for the task state: `multi()` chains record their commands and answer `exec`
 * from `transactions` in order; `eval` records the Lua call and answers `evalResult`.
 */
function fakeTaskRedis(options: { transactions: unknown[][]; evalResult?: number }) {
  const commands: unknown[][] = [];
  const evals: unknown[][] = [];
  let transaction = 0;
  const layer = fakeRedis({
    multi: () => {
      const values = options.transactions[transaction] ?? [];
      transaction += 1;
      const chain: Record<string, unknown> = new Proxy(
        {},
        {
          get: (_, name) =>
            name === "exec"
              ? async () => values.map((value) => [null, value])
              : (...args: unknown[]) => {
                  commands.push([name, ...args]);
                  return chain;
                },
        },
      );
      return chain;
    },
    eval: async (...args: unknown[]) => {
      evals.push(args);
      return options.evalResult ?? 1;
    },
    exists: async () => 1,
  });
  return { commands, evals, layer: Layer.mergeAll(layer, TestClock.layer()) };
}

const meta = (status: string) =>
  JSON.stringify({
    taskId: "task-1",
    userId: "user-1",
    status,
    createdAt: "2026-01-01T00:00:00.000Z",
    message: null,
  });

/** The [meta, counters, errors] a `getOpmlTask` transaction returns. */
const snapshot = (status: string, counters: Record<string, string>, errors: string[] = []) => [
  meta(status),
  counters,
  errors,
];

describe("opml task state", () => {
  test("finalizes a task as completed once the integer HINCRBY result reaches the total", async () => {
    // HINCRBY answers JS numbers; reading them as strings only would never finalize the task.
    const redis = fakeTaskRedis({
      transactions: [
        [1, 3, 1],
        snapshot("in_progress", {
          totalUrls: "3",
          completed: "3",
          subscribed: "2",
          alreadySubscribed: "1",
        }),
      ],
    });

    await runWith(recordOpmlTaskSuccess("task-1", { alreadySubscribed: false }), redis.layer);

    expect(redis.commands[0]).toEqual([
      "hincrby",
      "kyomi:opml:task:task-1:counters",
      "subscribed",
      1,
    ]);
    expect(redis.evals).toHaveLength(1);
    const [, , key, , patch, allowed] = redis.evals[0] as string[];
    expect(key).toBe(META_KEY);
    expect(JSON.parse(patch as string)).toMatchObject({
      status: "completed",
      message: "2 added. 1 existed",
    });
    expect(JSON.parse(allowed as string)).toEqual(["pending", "in_progress"]);
  });

  test("marks the task failed when every URL failed", async () => {
    const redis = fakeTaskRedis({
      transactions: [
        [1, 2, 1, 1, 1],
        snapshot("in_progress", { totalUrls: "2", completed: "2", failed: "2" }),
      ],
    });

    await runWith(
      recordOpmlTaskFailure("task-1", { url: "https://a.example/f", code: "C", message: "m" }),
      redis.layer,
    );

    expect(JSON.parse(redis.evals[0]?.[4] as string)).toMatchObject({
      status: "failed",
      message: "0 added. 0 existed. 2 failed",
    });
  });

  test("does not finalize while URLs are outstanding or once the task is terminal", async () => {
    const pending = fakeTaskRedis({
      transactions: [[1, 1, 1], snapshot("in_progress", { totalUrls: "3", completed: "1" })],
    });
    await runWith(recordOpmlTaskSuccess("task-1", { alreadySubscribed: false }), pending.layer);
    expect(pending.evals).toEqual([]);

    const cancelled = fakeTaskRedis({
      transactions: [[1, 3, 1], snapshot("cancelled", { totalUrls: "3", completed: "3" })],
    });
    await runWith(recordOpmlTaskSuccess("task-1", { alreadySubscribed: false }), cancelled.layer);
    expect(cancelled.evals).toEqual([]);
  });

  test("reads the task with its counters and recorded failures", async () => {
    const failure = { url: "https://a.example/f", code: "FEED_PARSE_FAILED", message: "bad" };
    const redis = fakeTaskRedis({
      transactions: [
        snapshot("in_progress", { totalUrls: "4", completed: "1", failed: "1" }, [
          JSON.stringify(failure),
        ]),
      ],
    });

    const state = await runWith(getOpmlTask("task-1"), redis.layer);

    expect(state).toMatchObject({
      taskId: "task-1",
      status: "in_progress",
      counters: { totalUrls: 4, completed: 1, failed: 1, subscribed: 0 },
      failures: [failure],
    });
  });

  test("answers null for a missing task and a RedisError for unreadable stored JSON", async () => {
    const missing = fakeTaskRedis({ transactions: [[null, {}, []]] });
    expect(await runWith(getOpmlTask("task-1"), missing.layer)).toBeNull();

    const corrupt = fakeTaskRedis({ transactions: [["{not json", {}, []]] });
    expect(await failureWith(getOpmlTask("task-1"), corrupt.layer)).toMatchObject({
      _tag: "RedisError",
      operation: "opml.task.parse_meta",
    });
  });

  test("surfaces an aborted transaction as a RedisError", async () => {
    const aborted = fakeRedis({
      multi: () => {
        const chain: Record<string, unknown> = new Proxy(
          {},
          { get: (_, name) => (name === "exec" ? async () => null : () => chain) },
        );
        return chain;
      },
    });

    const error = await failureWith(
      recordOpmlTaskSuccess("task-1", { alreadySubscribed: false }),
      aborted,
    );

    expect(error).toMatchObject({ _tag: "RedisError", operation: "opml.task.record_success" });
  });

  test("markInProgress only moves a pending task and failTask moves any task", async () => {
    const redis = fakeTaskRedis({ transactions: [] });

    await runWith(
      Effect.gen(function* () {
        yield* markOpmlTaskInProgress("task-1");
        yield* failOpmlTask("task-1", "Could not parse OPML XML");
      }),
      redis.layer,
    );

    expect(JSON.parse(redis.evals[0]?.[4] as string)).toEqual({ status: "in_progress" });
    expect(JSON.parse(redis.evals[0]?.[5] as string)).toEqual(["pending"]);
    expect(JSON.parse(redis.evals[1]?.[4] as string)).toMatchObject({
      status: "failed",
      message: "Could not parse OPML XML",
    });
    expect(JSON.parse(redis.evals[1]?.[5] as string)).toEqual([]);
  });

  test("reports a cancellation flag", async () => {
    const redis = fakeTaskRedis({ transactions: [] });
    expect(await runWith(isOpmlTaskCancelled("task-1"), redis.layer)).toBe(true);
  });
});
