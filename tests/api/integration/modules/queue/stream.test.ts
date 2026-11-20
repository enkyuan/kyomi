import { describe, expect, mock, test } from "bun:test";
import {
  JOBS_DEAD_LETTER_STREAM_KEY,
  claimPendingEntries,
  deadLetterJob,
  deadLetterRawEntry,
  ensureConsumerGroup,
  parseStreamEntry,
  readNewEntries,
  promoteDueRetries,
  retryKeyFor,
  scheduleRetry,
  type JobMessage,
  type StreamTarget,
} from "@kyomi/ingest";

const target: StreamTarget = {
  streamKey: "jobs:feed-refresh",
  group: "kyomi-workers",
  deadLetterStreamKey: JOBS_DEAD_LETTER_STREAM_KEY,
  streamMaxLength: 5_000,
};

const message: JobMessage = {
  id: "10-0",
  attempts: 1,
  rawFields: {},
  job: { type: "feed.refresh", payload: { feedId: "feed-1", userId: "user-1", generation: 4 } },
};

/** A client whose `multi()` records its commands and `exec()` returns `results`. */
function fakeTransaction(
  results: Array<[Error | null, unknown]> | null = [
    [null, "1-0"],
    [null, 1],
  ],
) {
  const commands: unknown[][] = [];
  const chain = {
    xadd: (...args: unknown[]) => {
      commands.push(["xadd", ...args]);
      return chain;
    },
    zadd: (...args: unknown[]) => {
      commands.push(["zadd", ...args]);
      return chain;
    },
    xack: (...args: unknown[]) => {
      commands.push(["xack", ...args]);
      return chain;
    },
    exec: async () => results,
  };
  return { redis: { multi: () => chain } as never, commands };
}

/** The `[field, value, ...]` list of the recorded XADD as a record. */
function addedFields(commands: unknown[][]): { stream: unknown; fields: Record<string, string> } {
  const [, stream, , , , , ...flat] = commands[0] as [string, string, ...string[]];
  const fields: Record<string, string> = {};
  for (let i = 0; i < flat.length; i += 2) {
    fields[flat[i]!] = flat[i + 1]!;
  }
  return { stream, fields };
}

/** The recorded ZADD: the retry set, when it is due, and the job it will come back as. */
function scheduled(commands: unknown[][]) {
  const [command, key, dueAt, member] = commands[0] as [string, string, number, string];
  expect(command).toBe("zadd");
  const { id, fields: flat } = JSON.parse(member) as { id: string; fields: string[] };
  const fields: Record<string, string> = {};
  for (let i = 0; i < flat.length; i += 2) {
    fields[flat[i]!] = flat[i + 1]!;
  }
  return { key, dueAt, id, flat, fields };
}

describe("scheduleRetry", () => {
  test("parks the job in the retry set until it is due, with the failure recorded as last_error", async () => {
    const { redis, commands } = fakeTransaction();

    await scheduleRetry(redis, target, message, "Feed fetch failed: HTTP 503", 1_700_000_005_000);

    const retry = scheduled(commands);
    expect(retry.key).toBe("jobs:feed-refresh:retry");
    expect(retry.dueAt).toBe(1_700_000_005_000);
    expect(retry.id).toBe("10-0");
    expect(retry.fields).toMatchObject({
      type: "feed.refresh",
      attempts: "2",
      last_error: "Feed fetch failed: HTTP 503",
    });
    expect(JSON.parse(retry.fields.payload!)).toEqual({
      feedId: "feed-1",
      userId: "user-1",
      generation: 4,
    });
  });

  test("acknowledges the entry in the same transaction and never puts it on the stream early", async () => {
    const { redis, commands } = fakeTransaction();

    await scheduleRetry(redis, target, message, "boom", 1);

    expect(commands.map(([command]) => command)).toEqual(["zadd", "xack"]);
    expect(commands[1]).toEqual(["xack", "jobs:feed-refresh", "kyomi-workers", "10-0"]);
  });

  test("a retried job parses back with its previous failure and attempt count", async () => {
    const { redis, commands } = fakeTransaction();
    await scheduleRetry(redis, target, message, "boom", 1);

    const parsed = parseStreamEntry(["11-0", scheduled(commands).flat]);

    expect(parsed.attempts).toBe(2);
    expect(parsed.rawFields.last_error).toBe("boom");
  });

  test("two failed jobs with the same fields stay two members of the set", async () => {
    const first = fakeTransaction();
    const second = fakeTransaction();
    await scheduleRetry(first.redis, target, message, "boom", 1);
    await scheduleRetry(second.redis, target, { ...message, id: "11-0" }, "boom", 1);

    expect(first.commands[0]![3]).not.toBe(second.commands[0]![3]);
  });

  test("fails when Redis reports an error for a command inside the transaction", async () => {
    const { redis } = fakeTransaction([
      [new Error("OOM command not allowed"), null],
      [null, 1],
    ]);

    await expect(scheduleRetry(redis, target, message, "x", 1)).rejects.toThrow("OOM");
  });
});

describe("promoteDueRetries", () => {
  function fakeEval(reply: unknown) {
    const calls: unknown[][] = [];
    return {
      redis: {
        eval: async (...args: unknown[]) => {
          calls.push(args);
          return reply;
        },
      } as never,
      calls,
    };
  }

  test("moves the due retries in one script run over the retry set and the stream", async () => {
    const { redis, calls } = fakeEval(3);

    const moved = await promoteDueRetries(redis, target, 1_700_000_000_000);

    expect(moved).toBe(3);
    const [script, keyCount, ...rest] = calls[0] as [string, number, ...string[]];
    expect(script).toContain("ZRANGEBYSCORE");
    expect(script).toContain("XADD");
    expect(script).toContain("ZREM");
    expect(keyCount).toBe(2);
    expect(rest).toEqual([
      "jobs:feed-refresh:retry",
      "jobs:feed-refresh",
      "1700000000000",
      "5000",
      "100",
    ]);
  });

  test("takes at most the limit it is given", async () => {
    const { redis, calls } = fakeEval(0);

    await promoteDueRetries(redis, target, 1, 7);

    expect((calls[0] as string[]).at(-1)).toBe("7");
  });
});

test("retryKeyFor keeps each stream's retries apart", () => {
  expect(retryKeyFor("jobs:feed-refresh")).toBe("jobs:feed-refresh:retry");
  expect(retryKeyFor("jobs:opml")).not.toBe(retryKeyFor("jobs:feed-refresh"));
});

describe("deadLetterJob", () => {
  test("records the failure where the dead-letter listing reads it", async () => {
    const { redis, commands } = fakeTransaction();

    await deadLetterJob(
      redis,
      target,
      message,
      "retries exhausted",
      new Date("2026-02-03T04:05:06.000Z"),
    );

    const added = addedFields(commands);
    expect(added.stream).toBe(JOBS_DEAD_LETTER_STREAM_KEY);
    expect(added.fields).toMatchObject({
      attempts: "2",
      error: "retries exhausted",
      last_error: "retries exhausted",
      failed_at: "2026-02-03T04:05:06.000Z",
      original_stream_id: "10-0",
    });
    expect(commands[1]).toEqual(["xack", "jobs:feed-refresh", "kyomi-workers", "10-0"]);
  });

  test("fails when Redis reports an error for a command inside the transaction", async () => {
    const { redis } = fakeTransaction([
      [new Error("OOM command not allowed"), null],
      [null, 1],
    ]);

    await expect(deadLetterJob(redis, target, message, "x")).rejects.toThrow("OOM");
  });
});

describe("deadLetterRawEntry", () => {
  test("keeps the raw fields of an entry that is not a job", async () => {
    const { redis, commands } = fakeTransaction();

    await deadLetterRawEntry(
      redis,
      target,
      ["12-0", ["type", "mystery", "payload", "{}"]],
      "Unsupported job type: mystery",
    );

    expect(addedFields(commands).fields).toMatchObject({
      type: "mystery",
      payload: "{}",
      attempts: "0",
      error: "Unsupported job type: mystery",
      original_stream_id: "12-0",
    });
  });

  test("wraps fields that do not pair up", async () => {
    const { redis, commands } = fakeTransaction();

    await deadLetterRawEntry(redis, target, ["13-0", ["odd"]], "bad");

    expect(addedFields(commands).fields.raw_fields).toBe('["odd"]');
  });
});

describe("consumer group and reads", () => {
  test("an existing group is not an error, any other failure is", async () => {
    const busy = {
      xgroup: mock(async () =>
        Promise.reject(new Error("BUSYGROUP Consumer Group name already exists")),
      ),
    };
    await expect(ensureConsumerGroup(busy as never, "g", "s")).resolves.toBeUndefined();

    const down = { xgroup: mock(async () => Promise.reject(new Error("Connection is closed."))) };
    await expect(ensureConsumerGroup(down as never, "g", "s")).rejects.toThrow(
      "Connection is closed",
    );
  });

  test("claims abandoned entries and reads new ones", async () => {
    const entries: Array<[string, string[]]> = [["1-0", ["type", "x"]]];
    const claimed = await claimPendingEntries({ call: async () => ["0-0", entries] } as never, {
      streamKey: "s",
      group: "g",
      consumer: "c",
      minIdleMs: 1_000,
      count: 5,
    });
    expect(claimed).toEqual(entries);

    const read = await readNewEntries({ xreadgroup: async () => [["s", entries]] } as never, {
      streamKey: "s",
      group: "g",
      consumer: "c",
      count: 5,
      blockMs: 10,
    });
    expect(read).toEqual(entries);

    const idle = await readNewEntries({ xreadgroup: async () => null } as never, {
      streamKey: "s",
      group: "g",
      consumer: "c",
      count: 5,
      blockMs: 10,
    });
    expect(idle).toEqual([]);
  });
});
