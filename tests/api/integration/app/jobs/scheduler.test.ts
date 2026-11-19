import { describe, expect, mock, test } from "bun:test";
import { Effect, Fiber, Layer } from "effect";
import { TestClock } from "effect/testing";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  buildFeedRefreshClaimSql,
  feedRefreshSchedulerLoop,
  normalizeSchedulerOptions,
  releaseFeedRefreshClaim,
  runFeedRefreshSchedulerTick,
} from "@app/jobs/scheduler";
import { fakeDb, fakeQueue, recordingLogger, testConfig } from "@api-tests/support/layers";

const claimedRow = (feedId: string, generation = 1) => ({
  feedId,
  reason: "scheduled",
  generation,
});

/** `execute` answers the queued-count query first, then the claim query. */
function fakeScheduleDb(options: {
  queuedCount?: number;
  claimed?: ReturnType<typeof claimedRow>[];
  released?: boolean;
  releaseError?: boolean;
  onExecute?: (call: number) => unknown;
}) {
  let calls = 0;
  const patches: Array<Record<string, unknown>> = [];
  const layer = fakeDb({
    transaction: async (run: (tx: unknown) => Promise<unknown>) =>
      run({
        execute: async (query: Parameters<PgDialect["sqlToQuery"]>[0]) => {
          const statement = new PgDialect().sqlToQuery(query).sql;
          if (
            statement.includes("pg_advisory_xact_lock") ||
            statement.includes("SET refresh_status='idle'")
          )
            return [];

          calls += 1;
          const override = options.onExecute?.(calls);
          if (override !== undefined) {
            return override;
          }
          return calls % 2 === 1 ? [{ count: options.queuedCount ?? 0 }] : (options.claimed ?? []);
        },
      }),
    update: () => ({
      set: (patch: Record<string, unknown>) => {
        if (options.releaseError) throw new Error("postgres unavailable");
        patches.push(patch);
        return {
          where: () => ({
            returning: async () => ((options.released ?? true) ? [{ id: "feed-x" }] : []),
          }),
        };
      },
    }),
  });
  return { layer, patches, calls: () => calls };
}

function publishedFeedIds(xadd: { mock: { calls: unknown[][] } }): string[] {
  return xadd.mock.calls.map((call) => {
    const fields = call.slice(5) as string[];
    return JSON.parse(fields[fields.indexOf("payload") + 1]!).feedId;
  });
}

describe("feed refresh claim SQL", () => {
  test("locks due rows with SKIP LOCKED, recovers stale claims and marks them queued", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const { sql } = new PgDialect().sqlToQuery(
      buildFeedRefreshClaimSql({
        now,
        subscribedLimit: 5,
        globalLimit: 2,
      }),
    );

    expect(sql).toContain("FOR UPDATE SKIP LOCKED");
    expect(sql).toContain("refresh_status = 'queued'");
    expect(sql).toContain("refresh_generation = feeds.refresh_generation + 1");
    expect(sql).toContain('feeds.refresh_generation AS "generation"');
  });

  test("normalizes scheduler limits", () => {
    expect(normalizeSchedulerOptions({}).subscribedLimit).toBe(50);
    expect(normalizeSchedulerOptions({ globalLimit: 10_000 }).globalLimit).toBe(1_000);
    expect(normalizeSchedulerOptions({ maxQueuedRefreshJobs: 0 }).maxQueuedRefreshJobs).toBe(1);
    expect(normalizeSchedulerOptions({ queuedLeaseMs: 1 }).queuedLeaseMs).toBe(60_000);
  });
});

describe("runFeedRefreshSchedulerTick", () => {
  function run(
    db: ReturnType<typeof fakeScheduleDb>,
    xadd: (...args: unknown[]) => Promise<string>,
    config: Record<string, string> = {},
  ) {
    const logs = recordingLogger();
    const layer = Layer.mergeAll(db.layer, fakeQueue({ xadd }), testConfig(config), logs.layer);
    return {
      logs,
      result: Effect.runPromise(runFeedRefreshSchedulerTick.pipe(Effect.provide(layer))),
    };
  }

  test("publishes one refresh job per claimed feed with its generation", async () => {
    const xadd = mock(async (..._args: unknown[]) => "1-0");
    const db = fakeScheduleDb({ claimed: [claimedRow("feed-a", 3), claimedRow("feed-b", 7)] });

    const { result, logs } = run(db, xadd);
    await result;

    expect(publishedFeedIds(xadd)).toEqual(["feed-a", "feed-b"]);
    expect(xadd.mock.calls[0]![0]).toBe("jobs:feed-refresh");
    expect(
      logs.entries.find((entry) => entry.event === "feed.scheduler.claimed")?.context,
    ).toMatchObject({ claimed: 2, published: 2 });
    expect(db.patches).toEqual([]);
  });

  test("releases a claim whose job could not be published and keeps publishing the rest", async () => {
    let call = 0;
    const xadd = mock(async (..._args: unknown[]) => {
      call += 1;
      if (call === 1) {
        throw new Error("redis unavailable");
      }
      return "2-0";
    });
    const db = fakeScheduleDb({ claimed: [claimedRow("feed-a"), claimedRow("feed-b")] });

    const { result, logs } = run(db, xadd);
    await result;

    expect(publishedFeedIds(xadd)).toEqual(["feed-a", "feed-b"]);
    expect(db.patches).toHaveLength(1);
    expect(db.patches[0]).toMatchObject({ refreshStatus: "idle" });
    const failure = logs.entries.find((entry) => entry.event === "feed.scheduler.publish_failed");
    expect(failure).toMatchObject({ level: "error", context: { feedId: "feed-a" } });
    expect(
      logs.entries.find((entry) => entry.event === "feed.scheduler.claimed")?.context,
    ).toMatchObject({ claimed: 2, published: 1 });
  });

  test("a claim that was superseded before the release is left alone", async () => {
    const xadd = mock(async (..._args: unknown[]): Promise<string> => {
      throw new Error("redis unavailable");
    });
    const db = fakeScheduleDb({ claimed: [claimedRow("feed-a")], released: false });

    const { result, logs } = run(db, xadd);
    await result;

    expect(db.patches).toHaveLength(1);
    expect(logs.entries.some((entry) => entry.event === "feed.scheduler.release_failed")).toBe(
      false,
    );
  });

  test("a failing release is logged and does not fail the tick", async () => {
    const xadd = mock(async (..._args: unknown[]): Promise<string> => {
      throw new Error("redis unavailable");
    });
    const db = fakeScheduleDb({ claimed: [claimedRow("feed-a")], releaseError: true }).layer;
    const logs = recordingLogger();

    await Effect.runPromise(
      runFeedRefreshSchedulerTick.pipe(
        Effect.provide(Layer.mergeAll(db, fakeQueue({ xadd }), testConfig(), logs.layer)),
      ),
    );

    expect(logs.entries.some((entry) => entry.event === "feed.scheduler.release_failed")).toBe(
      true,
    );
  });

  test("skips claiming while the queue is at capacity", async () => {
    const xadd = mock(async (..._args: unknown[]) => "1-0");
    const db = fakeScheduleDb({ queuedCount: 25 });

    const { result, logs } = run(db, xadd, { GLOBAL_FEED_REFRESH_MAX_QUEUED: "25" });
    await result;

    expect(db.calls()).toBe(1);
    expect(xadd).not.toHaveBeenCalled();
    expect(
      logs.entries.some((entry) => entry.event === "feed.scheduler.skipped_backpressure"),
    ).toBe(true);
  });
});

describe("releaseFeedRefreshClaim", () => {
  test("only returns a still-queued claim of the same generation", async () => {
    const db = fakeScheduleDb({});
    const released = await Effect.runPromise(
      releaseFeedRefreshClaim(claimedRow("feed-a", 4) as never, new Date()).pipe(
        Effect.provide(db.layer),
      ),
    );

    expect(released).toBe(true);
    expect(db.patches[0]).toMatchObject({ refreshStatus: "idle" });
  });
});

describe("feedRefreshSchedulerLoop", () => {
  const providers = (db: ReturnType<typeof fakeScheduleDb>, logs = recordingLogger()) =>
    Layer.mergeAll(db.layer, fakeQueue({ xadd: async () => "1-0" }), testConfig(), logs.layer);

  test("logs a failing tick and runs the next one", async () => {
    const logs = recordingLogger();
    const db = fakeScheduleDb({
      onExecute: (call) => {
        if (call === 1) {
          throw new Error("database unavailable");
        }
        return undefined;
      },
    });

    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(feedRefreshSchedulerLoop);
        yield* TestClock.adjust("61 seconds");
        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(Layer.mergeAll(providers(db, logs), TestClock.layer()))),
    );

    const events = logs.entries.map((entry) => entry.event);
    expect(events).toContain("feed.scheduler.failed");
    expect(events).toContain("feed.scheduler.claimed");
  });

  test("a tick in progress finishes before shutdown completes", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const db = fakeScheduleDb({
      onExecute: (call) => (call === 1 ? gate.then(() => [{ count: 0 }]) : undefined),
    });
    const logs = recordingLogger();

    const stopped = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(feedRefreshSchedulerLoop);
        yield* Effect.yieldNow;
        const stopping = yield* Effect.forkChild(Fiber.interrupt(fiber));
        yield* Effect.yieldNow;
        const before = stopping.pollUnsafe();
        release();
        yield* Fiber.join(stopping);
        return { stoppedEarly: before !== undefined };
      }).pipe(Effect.provide(Layer.mergeAll(providers(db, logs), TestClock.layer()))),
    );

    expect(stopped.stoppedEarly).toBe(false);
    expect(logs.entries.some((entry) => entry.event === "feed.scheduler.claimed")).toBe(true);
  });
});
