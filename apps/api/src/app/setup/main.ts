import { Context, Runtime } from "effect";

/**
 * Run an Effect as the process entrypoint. SIGINT and SIGTERM interrupt the main fiber, so scopes
 * close and finalizers run (stop consumers, close Redis and Postgres) before the process exits.
 * A requested stop exits 0; a failure (invalid environment, a crashed loop) exits non-zero.
 */
export const runMain = Runtime.makeRunMain(({ fiber, teardown }) => {
  // `once`: a second signal falls through to the default and ends the process immediately.
  const stop = () => {
    fiber.interruptUnsafe(fiber.id, Context.make(Runtime.InterruptExitCode, 0));
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  fiber.addObserver((exit) => {
    teardown(exit, (code) => process.exit(code));
  });
});
