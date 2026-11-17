import { describe, expect, test } from "bun:test";
import { Effect, Exit, Layer } from "effect";
import { makeFailureReporter, makeJobHandler } from "@app/jobs/handler";
import type { JobMessage } from "@kyomi/ingest";
import { fakeDb, fakeRedis, recordingLogger, testConfig } from "@api-tests/support/layers";

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
  const layer = Layer.mergeAll(fakeDb(db), fakeRedis({}), testConfig(), logs.layer);
  const build = Effect.gen(function* () {
    return { handle: yield* makeJobHandler, report: yield* makeFailureReporter };
  }).pipe(Effect.provide(layer));
  return { logs, build };
}

describe("job handler failures", () => {
  test("a deterministic AppError inside article extraction is permanent, not retried to dead-letter", async () => {
    const { build } = setup({ select: () => emptyQuery() });
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
    await expect(Effect.runPromise(report(error as never, null))).resolves.toBe("permanent");
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
    await expect(Effect.runPromise(report(error as never, job))).resolves.toBe("retry");
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
