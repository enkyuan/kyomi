import { Effect, type ManagedRuntime } from "effect";
import { Unauthorized } from "@shared/effect/errors";
import { runEffect } from "@shared/http/effect/bridge";
import {
  propagateOrMintRequestId,
  type MutableResponseHeaders,
} from "@shared/http/request-id/headers";
import { Auth } from "./service";

export type AuthContext = {
  userId: string;
};

/** The authenticated user behind these request headers, or `Unauthorized`. */
export const requireAuth = Effect.fn("auth.requireAuth")(function* (headers: Headers) {
  const auth = yield* Auth;
  const userId = yield* auth.sessionUserId(headers);
  const offlineOwner = headers.get("x-kyomi-offline-owner");
  if (userId === null || (offlineOwner !== null && offlineOwner !== userId)) {
    return yield* new Unauthorized({ message: "Unauthorized", code: "UNAUTHORIZED" });
  }
  return { userId } satisfies AuthContext;
});

/** Better Auth session: authenticated `userId` + propagated `requestId` (no org scope). */
export async function resolveSessionContext(
  runtime: ManagedRuntime.ManagedRuntime<Auth, unknown>,
  request: Request,
  set: { headers: MutableResponseHeaders },
) {
  const requestId = propagateOrMintRequestId(request, set);
  const { userId } = await runEffect({ runtime, request, requestId }, requireAuth(request.headers));
  return { userId, requestId };
}
