import { Context, Effect, Layer } from "effect";

export type FeedBackgroundShape = {
  /**
   * Run `task` after the request that asked for it has been answered. The fiber belongs to the
   * runtime's scope, so it is interrupted on shutdown instead of outliving the process, and it
   * keeps the request's context (request id in logs). The task handles its own failures.
   */
  readonly run: <R>(task: Effect.Effect<void, never, R>) => Effect.Effect<void, never, R>;
};

/** Best-effort work that must not block a response (favicon probing after a subscribe). */
export class FeedBackground extends Context.Service<FeedBackground, FeedBackgroundShape>()(
  "kyomi/FeedBackground",
) {
  static readonly layer = Layer.effect(
    FeedBackground,
    Effect.gen(function* () {
      const scope = yield* Effect.scope;
      return FeedBackground.of({
        run: (task) => Effect.asVoid(Effect.forkIn(task, scope)),
      });
    }),
  );
}
