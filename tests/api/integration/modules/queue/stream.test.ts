import { describe, expect, mock, test } from "bun:test";
import {
  JOBS_DEAD_LETTER_STREAM_KEY,
  claimPendingEntries,
  deadLetterJob,
  deadLetterRawEntry,
  ensureConsumerGroup,
  parseStreamEntry,
  readNewEntries,
  requeueJob,
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

describe("requeueJob", () => {
  test("puts the job back on its stream with the failure recorded as last_error", async () => {
    const { redis, commands } = fakeTransaction();

    await requeueJob(redis, target, message, "Feed fetch failed: HTTP 503");

    const added = addedFields(commands);
    expect(added.stream).toBe("jobs:feed-refresh");
    expect(added.fields).toMatchObject({
      type: "feed.refresh",
      attempts: "2",
      last_error: "Feed fetch failed: HTTP 503",
    });
    expect(JSON.parse(added.fields.payload!)).toEqual({
      feedId: "feed-1",
      userId: "user-1",
      generation: 4,
    });
    expect(commands[1]).toEqual(["xack", "jobs:feed-refresh", "kyomi-workers", "10-0"]);
  });

  test("a retried job parses back with its previous failure and attempt count", async () => {
    const { redis, commands } = fakeTransaction();
    await requeueJob(redis, target, message, "boom");

    const parsed = parseStreamEntry(["11-0", Object.entries(addedFields(commands).fields).flat()]);

    expect(parsed.attempts).toBe(2);
    expect(parsed.rawFields.last_error).toBe("boom");
  });
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
