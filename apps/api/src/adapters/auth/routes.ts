import { Elysia } from "elysia";
import { Effect, type ManagedRuntime } from "effect";
import { AppConfig } from "@config/env/service";
import { unexpected } from "@shared/effect/errors";
import { effectPlugin } from "@shared/http/effect/plugin";
import { requestObservationPlugin } from "@shared/http/stacks";
import {
  AUTH_CAPABILITIES_HEADER,
  getAuthCapabilities,
  serializeAuthCapabilities,
} from "./capabilities";
import { isOAuthTokenRequest, redactSessionToken } from "./redact";
import { Auth } from "./service";

type AuthRuntime = ManagedRuntime.ManagedRuntime<Auth | AppConfig, unknown>;

function withForwardedForHeader(request: Request, ipAddress?: string) {
  const headers = new Headers(request.headers);
  if (ipAddress) {
    headers.set("X-Forwarded-For", ipAddress);
  }
  return headers;
}

const withAuthCapabilities = (response: Response) =>
  AppConfig.useSync((config) => {
    const headers = new Headers(response.headers);
    headers.set(AUTH_CAPABILITIES_HEADER, serializeAuthCapabilities(getAuthCapabilities(config)));
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  });

/** Forward a request to Better Auth with the caller's address, then advertise the capabilities. */
const handleAuthRequest = Effect.fn("auth.handle")(function* (
  request: Request,
  ipAddress?: string,
) {
  const auth = yield* Auth;
  const headers = withForwardedForHeader(request, ipAddress);
  const response = yield* auth.handle(new Request(request, { headers }));
  // Page scripts read these responses, so none may carry the session token (the cookie is
  // HttpOnly so that they cannot). The mobile app's token endpoint is the one exception.
  const visible = isOAuthTokenRequest(request)
    ? response
    : yield* Effect.tryPromise({ try: () => redactSessionToken(response), catch: unexpected });
  return yield* withAuthCapabilities(visible);
});

const listSessions = Effect.fn("auth.listSessions")(function* (
  request: Request,
  ipAddress?: string,
) {
  const auth = yield* Auth;
  return yield* auth.listSessions(withForwardedForHeader(request, ipAddress));
});

export function authRoutes(runtime: AuthRuntime) {
  return new Elysia({
    name: "kyomi.auth.routes",
  })
    .use(requestObservationPlugin(runtime))
    .use(effectPlugin(runtime))
    .get("/api/auth/list-sessions", ({ request, server, runEffect }) =>
      runEffect(listSessions(request, server?.requestIP(request)?.address)),
    )
    .all(
      "/api/auth",
      ({ request, server, runEffect }) =>
        runEffect(handleAuthRequest(request, server?.requestIP(request)?.address)),
      { parse: "none" },
    )
    .all(
      "/api/auth/*",
      ({ request, server, runEffect }) =>
        runEffect(handleAuthRequest(request, server?.requestIP(request)?.address)),
      { parse: "none" },
    );
}
