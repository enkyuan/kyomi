import { Duration, Effect, Schedule } from "effect";
import type { Elysia } from "elysia";
import { AppLogger } from "@adapters/logger/service";

type ListenRetryOptions = {
  port: number;
  maxRequestBodySize?: number;
  retries: number;
  retryDelayMs: number;
};

export function buildListenOptions(options: { port: number; maxRequestBodySize?: number }): {
  port: number;
  maxRequestBodySize?: number;
} {
  return options.maxRequestBodySize === undefined
    ? { port: options.port }
    : { port: options.port, maxRequestBodySize: options.maxRequestBodySize };
}

function isAddressInUseError(error: unknown): error is Error & { code?: string } {
  return (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    error.code === "EADDRINUSE"
  );
}

/**
 * Start listening, waiting out a port that a restarting process has not released yet: while the
 * port is in use, try again every `retryDelayMs` for up to `retries` more attempts. Any other
 * failure, or running out of attempts, fails the effect with the listen error.
 */
export const listenWithRetry = Effect.fn("http.listen")(function* (
  app: Elysia,
  options: ListenRetryOptions,
) {
  const log = yield* AppLogger;
  let attempt = 0;

  yield* Effect.try({
    try: () => app.listen(buildListenOptions(options)),
    catch: (cause) => cause,
  }).pipe(
    Effect.retry({
      schedule: Schedule.max([
        Schedule.spaced(Duration.millis(options.retryDelayMs)),
        Schedule.recurs(options.retries),
      ]),
      while: (error) => {
        if (!isAddressInUseError(error)) {
          return Effect.succeed(false);
        }
        attempt += 1;
        return log
          .warn("server.port_in_use.retrying", {
            port: options.port,
            attempt,
            retries: options.retries,
            retryDelayMs: options.retryDelayMs,
          })
          .pipe(Effect.as(true));
      },
    }),
  );
});
