import { Elysia } from "elysia";
import type { Effect, ManagedRuntime } from "effect";
import type { RequestContext } from "@shared/effect/request";
import { propagateOrMintRequestId } from "@shared/http/request-id/headers";
import { runEffect } from "./bridge";

/**
 * Derives `runEffect(effect)` for public routes, with the runtime's services fixed.
 * The request id is the one already on the response (set by session resolution) or a freshly
 * minted one, so correlation ids are never replaced mid-request.
 *
 * Handlers on authenticated routes call `runEffect({ runtime, request, requestId, userId }, effect)`
 * from `./bridge` once the session has resolved.
 *
 * The runtime is deliberately not decorated onto the context: Elysia deep-merges decorators each
 * time a plugin is mounted, and walking a built runtime (pools, clients) never finishes.
 */
export function effectPlugin<R>(runtime: ManagedRuntime.ManagedRuntime<R, unknown>) {
  return new Elysia({ name: "kyomi.http.effect" }).derive({ as: "scoped" }, ({ request, set }) => {
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
