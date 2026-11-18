import { Effect, Option, Semaphore } from "effect";
import { RateLimited } from "@shared/effect/errors";

/**
 * Runs the effects it wraps with at most `max` in flight in this process; one more is refused with
 * a 429 instead of queued. For public routes that fetch from the network on the caller's behalf
 * and have no identity to rate limit by: this bounds the sockets, memory and bandwidth they can
 * hold at once, whoever is asking.
 */
export function makeLoadShedder(name: string, max: number) {
  const gate = Semaphore.makeUnsafe(max);
  return <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    gate
      .withPermitsIfAvailable(1)(effect)
      .pipe(
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail(
                new RateLimited({
                  message: "Too many requests are in progress. Try again shortly.",
                  code: "TOO_MANY_CONCURRENT_REQUESTS",
                  details: { bucket: name },
                }),
              ),
            onSome: Effect.succeed,
          }),
        ),
      );
}
