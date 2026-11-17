import { describe, expect, test } from "bun:test";
import { Effect, Fiber, Layer } from "effect";
import { enqueueBatchFeedRefresh, enqueueFeedRefresh } from "@modules/feeds/refresh/enqueue";
import { fakeDb, fakeQueue, recordingLogger } from "@api-tests/support/layers";

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `update().set().where().returning()`: the claim. `claimed` decides which feeds are claimed (in
 * call order); the in-flight counter records how many claims overlap.
 */
function claimingDb(claimed: (call: number) => boolean) {
  let call = 0;
  let inFlight = 0;
  const stats = { maxInFlight: 0, sets: [] as unknown[] };
  const methods = {
    update: () => ({
      set: (values: unknown) => {
        stats.sets.push(values);
        const index = call++;
        return {
          where: () => ({
            returning: async () => {
              inFlight += 1;
              stats.maxInFlight = Math.max(stats.maxInFlight, inFlight);
              await delay(5);
              inFlight -= 1;
              return claimed(index) ? [{ generation: index + 1 }] : [];
            },
          }),
        };
      },
    }),
  };
  return { methods, stats };
}

function environment(options: {
  db: ReturnType<typeof claimingDb>["methods"];
  xadd?: (...args: unknown[]) => Promise<unknown>;
}) {
  const logs = recordingLogger();
  const published: unknown[][] = [];
  const xadd =
    options.xadd ??
    (async (...args: unknown[]) => {
      published.push(args);
      return `1-${published.length}`;
    });
  return {
    layer: Layer.mergeAll(fakeDb(options.db), fakeQueue({ xadd }), logs.layer),
    logs,
    published,
  };
}

const feedIds = (count: number) => Array.from({ length: count }, (_, i) => `feed-${i}`);

describe("enqueueFeedRefresh", () => {
  test("an interruption after the claim commits still publishes the job", async () => {
    const { methods } = claimingDb(() => true);
    const { layer, published } = environment({ db: methods });

    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(enqueueFeedRefresh("feed-1", "user-1", "manual"));
        // The claim UPDATE takes 5ms; interrupt while it is in flight.
        yield* Effect.sleep("1 millis");
        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(layer)),
    );

    expect(published).toHaveLength(1);
  });

  test("an interruption during a batch claim still publishes every claimed job", async () => {
    const { methods } = claimingDb(() => true);
    const { layer, published } = environment({ db: methods });

    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          enqueueBatchFeedRefresh(feedIds(3), "user-1", "manual"),
        );
        yield* Effect.sleep("1 millis");
        yield* Fiber.interrupt(fiber);
      }).pipe(Effect.provide(layer)),
    );

    expect(published).toHaveLength(3);
  });

  test("claims the feed, publishes a feed.refresh job and logs it", async () => {
    const { methods, stats } = claimingDb(() => true);
    const { layer, logs, published } = environment({ db: methods });

    const result = await Effect.runPromise(
      enqueueFeedRefresh("feed-1", "user-1", "manual").pipe(Effect.provide(layer)),
    );

    expect(result).toEqual({
      jobId: "1-1",
      generation: 1,
      coalesced: false,
      deliveryPending: false,
    });
    expect(stats.sets[0]).toMatchObject({ refreshStatus: "queued", lastRefreshError: null });
    expect(published).toHaveLength(1);
    expect(published[0]).toContain("jobs:feed-refresh");
    expect(logs.entries).toEqual([
      {
        level: "info",
        event: "queue.job.enqueued",
        context: {
          jobId: "1-1",
          jobType: "feed.refresh",
          feedId: "feed-1",
          userId: "user-1",
          reason: "manual",
          generation: 1,
        },
      },
    ]);
  });

  test("coalesces into the refresh that is already queued or running", async () => {
    const { methods } = claimingDb(() => false);
    const { layer, published, logs } = environment({ db: methods });

    const result = await Effect.runPromise(
      enqueueFeedRefresh("feed-1", "user-1", "manual").pipe(Effect.provide(layer)),
    );

    expect(result).toEqual({ jobId: "", coalesced: true, deliveryPending: false });
    expect(published).toHaveLength(0);
    expect(logs.entries).toHaveLength(0);
  });

  test("a publish failure leaves the claim for the scheduler and is logged with its cause", async () => {
    const { methods } = claimingDb(() => true);
    const { layer, logs } = environment({
      db: methods,
      xadd: async () => {
        throw new Error("redis is down");
      },
    });

    const result = await Effect.runPromise(
      enqueueFeedRefresh("feed-1", "user-1", "subscription_created").pipe(Effect.provide(layer)),
    );

    expect(result).toEqual({ jobId: "", generation: 1, coalesced: false, deliveryPending: true });
    expect(logs.entries).toEqual([
      {
        level: "error",
        event: "queue.job.delivery_pending",
        context: expect.objectContaining({
          feedId: "feed-1",
          reason: "subscription_created",
          generation: 1,
          error: expect.objectContaining({
            name: "RedisError",
            cause: expect.objectContaining({ message: "redis is down" }),
          }),
        }),
      },
    ]);
  });

  test("a failing claim is a typed DatabaseError, not delivery pending", async () => {
    const { layer } = environment({
      db: {
        update: () => ({
          set: () => ({
            where: () => ({ returning: () => Promise.reject(new Error("deadlock")) }),
          }),
        }),
      },
    });

    const error = await Effect.runPromise(
      Effect.flip(enqueueFeedRefresh("feed-1", "user-1", "manual")).pipe(Effect.provide(layer)),
    );

    expect(error).toMatchObject({ _tag: "DatabaseError", operation: "feeds.refresh.claim" });
  });
});

describe("enqueueBatchFeedRefresh", () => {
  test("an empty batch touches nothing", async () => {
    const { methods } = claimingDb(() => true);
    const { layer, published } = environment({ db: methods });

    const result = await Effect.runPromise(
      enqueueBatchFeedRefresh([], "user-1", "manual").pipe(Effect.provide(layer)),
    );

    expect(result).toEqual({
      accepted: true,
      count: 0,
      coalescedCount: 0,
      deliveryPendingCount: 0,
    });
    expect(published).toHaveLength(0);
  });

  test("counts claimed, coalesced and delivery-pending feeds", async () => {
    // Feeds 0 and 3 are already queued; of the other three, the second publish fails.
    const { methods } = claimingDb((call) => call !== 0 && call !== 3);
    let publishes = 0;
    const { layer, logs } = environment({
      db: methods,
      xadd: async () => {
        publishes += 1;
        if (publishes === 2) {
          throw new Error("redis is down");
        }
        return `1-${publishes}`;
      },
    });

    const result = await Effect.runPromise(
      enqueueBatchFeedRefresh(feedIds(5), "user-1", "manual").pipe(Effect.provide(layer)),
    );

    expect(result).toEqual({
      accepted: true,
      count: 3,
      coalescedCount: 2,
      deliveryPendingCount: 1,
    });
    expect(logs.entries.at(-1)).toEqual({
      level: "info",
      event: "queue.job.enqueued.batch",
      context: { count: 3, coalescedCount: 2, deliveryPendingCount: 1, userId: "user-1" },
    });
  });

  test("keeps at most five claims in flight so one user cannot drain the pool", async () => {
    const { methods, stats } = claimingDb(() => true);
    const { layer, published } = environment({ db: methods });

    const result = await Effect.runPromise(
      enqueueBatchFeedRefresh(feedIds(20), "user-1", "manual").pipe(Effect.provide(layer)),
    );

    expect(result.count).toBe(20);
    expect(published).toHaveLength(20);
    expect(stats.maxInFlight).toBeGreaterThan(1);
    expect(stats.maxInFlight).toBeLessThanOrEqual(5);
  });
});
