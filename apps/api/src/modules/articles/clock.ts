import { Clock, Effect } from "effect";

/** The Effect clock's current time as a `Date`; tests control it with `TestClock`. */
export const currentDate: Effect.Effect<Date> = Effect.map(
  Clock.currentTimeMillis,
  (millis) => new Date(millis),
);
