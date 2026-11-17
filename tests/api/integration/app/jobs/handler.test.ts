import { describe, expect, test } from "bun:test";
import { Effect, Exit, Fiber, Layer } from "effect";
import { attemptJob, makeFailureReporter, makeJobHandler } from "@app/jobs/handler";
import type { JobMessage } from "@kyomi/ingest";
import {
  fakeDb,
  fakeHttpClient,
  fakeQueue,
  recordingLogger,
  testConfig,
} from "@api-tests/support/layers";
import { feedsLayer } from "../../modules/opml/fixtures";

/** A query chain that resolves to no rows however it is built up. */
function emptyQuery(): unknown {
  const query: unknown = new Proxy(() => undefined, {
    get: (_target, property) =>
      property === "then" ? (resolve: (rows: unknown[]) => void) => resolve([]) : () => query,
    apply: () => query,
  });
  return query;
}

const message = (job: JobMessage["job"], attempts = 0): JobMessage => ({
  id: "1-0",
  job,
  attempts,
  rawFields: {},
});

function setup(db: Parameters<typeof fakeDb>[0]) {
  const logs = recordingLogger();
  const layer = Layer.mergeAll(
    fakeDb(db),
    fakeQueue({}),
    fakeHttpClient(() => {
      throw new Error("the job handler tests make no outbound requests");
    }),
    testConfig(),
    feedsLayer().layer,
    logs.layer,
  );
  const build = Effect.gen(function* () {
    return { handle: yield* makeJobHandler, report: yield* makeFailureReporter };
  }).pipe(Effect.provide(layer));
  return { logs, build };
}

describe("job handler failures", () => {
  test("a deterministic NotFound inside article extraction is logged as expected and left to the consumer's retry", async () => {
    const { build, logs } = setup({ select: () => emptyQuery() });
    const { handle, report } = await Effect.runPromise(build);

    const exit = await Effect.runPromiseExit(
      handle(
        message({
          type: "article.extract",
          payload: { articleId: "missing", userId: "user-1", requestedAt: "2026-01-01T00:00:00Z" },
        }),
      ),
    );

    expect(Exit.isFailure(exit)).toBe(true);
    const failure = Exit.isFailure(exit) ? exit.cause.reasons[0] : undefined;
    const error = (failure as { error?: { _tag: string; code?: string } } | undefined)?.error;
    expect(error?._tag).toBe("NotFound");
    await Effect.runPromise(report(error as never, null));
    expect(logs.entries).toContainEqual(
      expect.objectContaining({
        level: "warn",
        event: "worker.job.failed",
        context: expect.objectContaining({ retryable: false }),
      }),
    );
  });

  test("an unexpected throw from a module is a retryable internal failure with its message kept", async () => {
    const { build, logs } = setup({
      update: () => ({
        set: () => ({ where: () => ({ returning: async () => [{ generation: 0 }] }) }),
      }),
      select: () => {
        throw new Error("connection terminated unexpectedly");
      },
    });
    const { handle, report } = await Effect.runPromise(build);
    const job = message({
      type: "feed.refresh",
      payload: { feedId: "feed-1", userId: "system", generation: 0 },
    });

    const exit = await Effect.runPromiseExit(handle(job));

    const error = Exit.isFailure(exit)
      ? (
          exit.cause.reasons[0] as {
            error: { _tag: string; message: string; failureClass?: string };
          }
        ).error
      : undefined;
    expect(error).toMatchObject({
      _tag: "FeedRefreshFailed",
      message: "connection terminated unexpectedly",
    });
    await Effect.runPromise(report(error as never, job));
    expect(logs.entries).toContainEqual(
      expect.objectContaining({
        level: "error",
        event: "worker.job.failed",
        context: expect.objectContaining({
          jobType: "feed.refresh",
          feedId: "feed-1",
          errorClass: "unknown",
          retryable: true,
        }),
      }),
    );
  });

  test("a refresh whose feed no longer exists is acknowledged instead of retried", async () => {
    const { build, logs } = setup({
      update: () => ({
        set: () => ({ where: () => ({ returning: async () => [{ generation: 0 }] }) }),
      }),
      select: () => emptyQuery(),
    });
    const { handle } = await Effect.runPromise(build);

    const exit = await Effect.runPromiseExit(
      handle(message({ type: "feed.refresh", payload: { feedId: "gone", userId: "system" } })),
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(logs.entries).toContainEqual(
      expect.objectContaining({
        level: "warn",
        event: "worker.job.feed_refresh.failed",
        context: expect.objectContaining({
          feedId: "gone",
          retryable: false,
          error: "Feed not found",
        }),
      }),
    );
  });
});

describe("attemptJob", () => {
  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  test("an interrupted job ends only after its Promise has settled", async () => {
    const order: string[] = [];
    const work = async () => {
      order.push("started");
      await delay(40);
      order.push("settled");
    };

    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(attemptJob(work, Effect.void));
        yield* Effect.sleep("5 millis");
        yield* Fiber.interrupt(fiber);
        order.push("interrupted");
      }),
    );

    expect(order).toEqual(["started", "settled", "interrupted"]);
  });

  test("a Promise that outlasts the settle window is abandoned and reported", async () => {
    let abandoned = false;

    await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          attemptJob(
            () => delay(200),
            Effect.sync(() => {
              abandoned = true;
            }),
            "10 millis",
          ),
        );
        yield* Effect.sleep("5 millis");
        yield* Fiber.interrupt(fiber);
      }),
    );

    expect(abandoned).toBe(true);
  });

  test("a rejection becomes a typed job failure and nothing is abandoned", async () => {
    let abandoned = false;

    const failure = await Effect.runPromise(
      Effect.flip(
        attemptJob(
          () => Promise.reject(new Error("connection terminated")),
          Effect.sync(() => {
            abandoned = true;
          }),
        ),
      ),
    );

    expect(failure).toMatchObject({ _tag: "InternalError", message: "connection terminated" });
    expect(abandoned).toBe(false);
  });
});
