import { Elysia } from "elysia";
import type { Effect, ManagedRuntime } from "effect";
import type { RequestContext } from "@shared/effect/request";
import { propagateOrMintRequestId } from "@shared/http/request-id/headers";
import { runEffect } from "./bridge";

/**
 * Puts the app runtime on the Elysia context and derives `runEffect(effect)` for public routes.
 * The request id is the one already on the response (set by session resolution) or a freshly
 * minted one, so correlation ids are never replaced mid-request.
 *
 * Handlers on authenticated routes call `runEffect({ runtime, request, requestId, userId }, effect)`
 * from `./bridge` once the session has resolved.
 */
export function effectPlugin<R>(runtime: ManagedRuntime.ManagedRuntime<R, unknown>) {
  return new Elysia({ name: "kyomi.http.effect" })
    .decorate("runtime", runtime)
    .derive({ as: "scoped" }, ({ request, set }) => {
      const existing = set.headers["x-request-id"];
      const requestId =
        typeof existing === "string" && existing.length > 0
          ? existing
          : propagateOrMintRequestId(request, set);
      return {
        requestId,
        runEffect: <A, E>(effect: Effect.Effect<A, E, R | RequestContext>) =>
          runEffect({ runtime, request, requestId }, effect),
      };
    });
}
