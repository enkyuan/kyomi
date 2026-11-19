import { Cause, Effect } from "effect";
import { AppLogger } from "@adapters/logger/service";
import { serializeError } from "@shared/errors/serialize";

/**
 * Failure handler for a scheduler tick: logs what failed (typed failure or defect) with its cause
 * chain so the loop carries on with the next tick. Interruption is not a failure; it never reaches
 * here because ticks run uninterruptibly.
 */
export const logTickFailure = (event: string) =>
  Effect.fn("jobs.tick.failed")(function* (cause: Cause.Cause<unknown>) {
    const log = yield* AppLogger;
    yield* log.error(event, { error: serializeError(Cause.squash(cause)) });
  });
