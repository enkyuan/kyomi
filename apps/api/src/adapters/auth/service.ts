import { Context, Effect, FiberSet, Layer } from "effect";
import type { HttpClient } from "effect/http";
import { APIError } from "better-auth/api";
import { Db } from "@adapters/db/service";
import type { AppLogger } from "@adapters/logger/service";
import { AppConfig } from "@config/env/service";
import {
  ConfigError,
  Forbidden,
  InternalError,
  Unauthorized,
  unexpected,
  type PublicError,
} from "@shared/effect/errors";
import { createAuth } from "./instance";
import { hydrateStoredLocation, type LocationFields } from "./location";
import { queueEmailOTP } from "./otp";

/** One of the user's sessions, with its stored location filled in for display. */
export type AuthSession = Awaited<
  ReturnType<ReturnType<typeof createAuth>["api"]["listSessions"]>
>[number] &
  LocationFields;

export type AuthShape = {
  /** Better Auth's HTTP surface (`/api/auth/*`): sign-in, OAuth, sessions. */
  readonly handle: (request: Request) => Effect.Effect<Response, InternalError>;
  /** The signed-in user's id for these request headers, or `null` when there is no session. */
  readonly sessionUserId: (headers: Headers) => Effect.Effect<string | null, InternalError>;
  readonly listSessions: (headers: Headers) => Effect.Effect<AuthSession[], PublicError>;
};

/** Better Auth's own 4xx become the matching public error; anything else is an opaque 500. */
function toAuthError(cause: unknown): PublicError {
  if (cause instanceof APIError) {
    if (cause.statusCode === 401) {
      return new Unauthorized({ message: cause.message, cause });
    }
    if (cause.statusCode === 403) {
      return new Forbidden({ message: cause.message, cause });
    }
  }
  return unexpected(cause);
}

/**
 * Authentication through Better Auth, built from `AppConfig` and the `Db` service. Sign-in code
 * emails are sent in the background on a fiber set owned by the layer, so closing the runtime
 * interrupts deliveries still in flight instead of leaving them detached.
 */
export class Auth extends Context.Service<Auth, AuthShape>()("kyomi/Auth") {
  static readonly layer = Layer.effect(
    Auth,
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const db = yield* Db;
      const deliver = yield* FiberSet.makeRuntime<AppConfig | AppLogger | HttpClient.HttpClient>();
      const auth = yield* Effect.try({
        try: () =>
          createAuth({
            config,
            db: db.client,
            sendOtp: (message) => {
              deliver(queueEmailOTP(message));
            },
          }),
        catch: (cause) => new ConfigError({ message: "Invalid auth configuration", cause }),
      });

      return Auth.of({
        handle: (request) =>
          Effect.tryPromise({ try: () => auth.handler(request), catch: unexpected }),
        sessionUserId: (headers) =>
          Effect.tryPromise({
            try: () => auth.api.getSession({ headers }),
            catch: unexpected,
          }).pipe(Effect.map((session) => session?.user?.id ?? null)),
        listSessions: (headers) =>
          Effect.tryPromise({
            try: () => auth.api.listSessions({ headers }),
            catch: toAuthError,
          }).pipe(
            Effect.map((sessions) => sessions.map((session) => hydrateStoredLocation(session))),
          ),
      });
    }),
  );
}
