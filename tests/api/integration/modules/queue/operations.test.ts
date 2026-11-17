import { describe, expect, mock, test } from "bun:test";
import { Effect, Exit, Layer } from "effect";
import type { AppLogger } from "@adapters/logger/service";
import type { JobQueue } from "@adapters/queue/service";
import type { Redis } from "@adapters/redis/service";
import { listDeadLetters, replayDeadLetters } from "@modules/queue/operations";
import { CurrentUser } from "@shared/effect/request";
import { fakeQueue, recordingLogger } from "@api-tests/support/layers";

const deadLetter = (id: string, fields: Record<string, string>): [string, string[]] => [
  id,
  Object.entries(fields).flat(),
];

const refreshPayload = JSON.stringify({ feedId: "feed-1", userId: "system" });

function run<A, E>(
  effect: Effect.Effect<A, E, Redis | JobQueue | AppLogger | CurrentUser>,
  redis: Parameters<typeof fakeQueue>[0],
  logs = recordingLogger(),
) {
  return Effect.runPromiseExit(
    effect.pipe(
      Effect.provideService(CurrentUser, { userId: "admin-1" }),
      Effect.provide(Layer.mergeAll(fakeQueue(redis), logs.layer)),
    ),
  );
}

describe("listDeadLetters", () => {
  test("maps stream entries to items, reading the error the way dead-lettering writes it", async () => {
    const xrevrange = mock(async () => [
      deadLetter("3-0", {
        type: "feed.refresh",
        payload: refreshPayload,
        attempts: "3",
        error: "Feed fetch failed: HTTP 503",
        failed_at: "2026-01-01T00:00:00.000Z",
        original_stream_id: "1-0",
      }),
      // Entries written before `error` existed only carry `last_error` (when they carry anything).
      deadLetter("2-0", {
        type: "feed.refresh",
        payload: refreshPayload,
        last_error: "old failure",
      }),
      deadLetter("1-0", { type: "opml.import.feed" }),
    ]);
    const logs = recordingLogger();

    const exit = await run(listDeadLetters(25), { xrevrange }, logs);

    expect(Exit.isSuccess(exit) && exit.value).toEqual([
      {
        id: "3-0",
        type: "feed.refresh",
        attempts: 3,
        error: "Feed fetch failed: HTTP 503",
        failedAt: "2026-01-01T00:00:00.000Z",
        originalStreamId: "1-0",
        payload: refreshPayload,
      },
      {
        id: "2-0",
        type: "feed.refresh",
        attempts: 0,
        error: "old failure",
        failedAt: null,
        originalStreamId: null,
        payload: refreshPayload,
      },
      {
        id: "1-0",
        type: "opml.import.feed",
        attempts: 0,
        error: null,
        failedAt: null,
        originalStreamId: null,
        payload: "{}",
      },
    ]);
    expect(xrevrange).toHaveBeenCalledWith("jobs:dead-letter", "+", "-", "COUNT", 25);
    expect(logs.entries).toContainEqual(
      expect.objectContaining({
        event: "queue.dead_letter.listed",
        context: { userId: "admin-1", count: 3 },
      }),
    );
  });

  test("a Redis failure is a typed failure, not a crash", async () => {
    const exit = await run(listDeadLetters(5), {
      xrevrange: async () => {
        throw new Error("Connection is closed.");
      },
    });

    expect(Exit.isFailure(exit)).toBe(true);
  });
});

describe("replayDeadLetters", () => {
  test("publishes each found job again, removes it and skips ids that are gone", async () => {
    const xrange = mock(async (_stream: string, id: string) =>
      id === "2-0"
        ? []
        : [
            deadLetter(id, {
              type: "feed.refresh",
              payload: refreshPayload,
              attempts: "3",
              error: "x",
            }),
          ],
    );
    const xadd = mock(async (..._args: unknown[]) => "9-0");
    const xdel = mock(async (..._args: unknown[]) => 1);

    const exit = await run(replayDeadLetters(["1-0", "2-0", "3-0"]), { xrange, xadd, xdel });

    expect(Exit.isSuccess(exit) && exit.value).toEqual({
      message: "Replayed 2 dead-letter job(s)",
      replayed: 2,
    });
    expect(xadd).toHaveBeenCalledTimes(2);
    expect(xdel.mock.calls.map((call) => call[1])).toEqual(["1-0", "3-0"]);
    // The replayed job starts over: the stream entry carries no attempts or previous error.
    const fields = xadd.mock.calls[0]!.slice(5) as string[];
    expect(fields).toEqual(["type", "feed.refresh", "payload", refreshPayload]);
  });

  test("keeps the dead-letter entry when publishing fails", async () => {
    const xdel = mock(async () => 1);

    const exit = await run(replayDeadLetters(["1-0"]), {
      xrange: async () => [deadLetter("1-0", { type: "feed.refresh", payload: refreshPayload })],
      xadd: async () => {
        throw new Error("Connection is closed.");
      },
      xdel,
    });

    expect(Exit.isFailure(exit)).toBe(true);
    expect(xdel).not.toHaveBeenCalled();
  });

  test("an entry that is not a valid job fails the replay as an internal error", async () => {
    const exit = await run(replayDeadLetters(["1-0"]), {
      xrange: async () => [deadLetter("1-0", { type: "mystery", payload: "{}" })],
    });

    expect(Exit.isFailure(exit)).toBe(true);
    expect(JSON.stringify(exit)).toContain("InternalError");
  });
});
