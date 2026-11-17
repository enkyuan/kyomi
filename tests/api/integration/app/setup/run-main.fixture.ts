import { Effect } from "effect";
import { runMain } from "@app/setup/main";

/**
 * A process entrypoint shaped like `boot/server.ts`: three scoped resources acquired in order,
 * then the main fiber waits (or fails when asked to). `main.test.ts` spawns it and signals it.
 */
const mode = process.argv[2];

const resource = (name: string) =>
  Effect.acquireRelease(
    Effect.sync(() => console.log(`acquired ${name}`)),
    () =>
      // The pause makes an out-of-order or skipped release visible in the output.
      Effect.promise(() => new Promise<void>((resolve) => setTimeout(resolve, 10))).pipe(
        Effect.andThen(Effect.sync(() => console.log(`released ${name}`))),
      ),
  );

const program = Effect.gen(function* () {
  yield* resource("pool");
  yield* resource("redis");
  yield* resource("server");
  console.log("ready");
  if (mode === "fail") {
    return yield* Effect.fail(new Error("boom"));
  }
  return yield* Effect.never;
}).pipe(Effect.scoped);

runMain(program);
