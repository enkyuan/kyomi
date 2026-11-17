import { Effect, Exit, type ManagedRuntime } from "effect";
import { CurrentUser, RequestContext } from "@shared/effect/request";
import { describeCause, EffectFailure } from "@shared/http/error/render";

/** What a route handler knows about the request it is serving. */
export type HttpEffectContext<R, UserId extends string | undefined = undefined> = {
  readonly runtime: ManagedRuntime.ManagedRuntime<R, unknown>;
  readonly request: Request;
  readonly requestId: string;
  readonly userId?: UserId;
};

/**
 * Run an Effect for one HTTP request and hand back a Promise Elysia can return.
 *
 * - Provides `RequestContext` (and `CurrentUser` when `userId` is set) with
 *   `Effect.provideService`, so an Effect that needs a user does not type-check on a public route.
 * - Interrupts the fiber when `request.signal` aborts.
 * - On failure throws `EffectFailure`; `registerErrorHandlers` renders it through `describeError`.
 */
export function runEffect<R, A, E>(
  ctx: HttpEffectContext<R>,
  effect: Effect.Effect<A, E, R | RequestContext>,
): Promise<A>;
export function runEffect<R, A, E>(
  ctx: HttpEffectContext<R, string>,
  effect: Effect.Effect<A, E, R | RequestContext | CurrentUser>,
): Promise<A>;
export async function runEffect<R, A, E>(
  ctx: HttpEffectContext<R, string | undefined>,
  effect: Effect.Effect<A, E, R | RequestContext | CurrentUser>,
): Promise<A> {
  const url = new URL(ctx.request.url);
  const withRequest = Effect.provideService(effect, RequestContext, {
    requestId: ctx.requestId,
    method: ctx.request.method,
    path: url.pathname,
  });
  const program =
    ctx.userId === undefined
      ? withRequest
      : Effect.provideService(withRequest, CurrentUser, { userId: ctx.userId });

  const exit = await ctx.runtime.runPromiseExit(program as Effect.Effect<A, E, R>, {
    signal: ctx.request.signal,
  });
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }
  throw new EffectFailure(describeCause(exit.cause, ctx.request.signal.aborted));
}
