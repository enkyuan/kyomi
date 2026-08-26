import { Elysia } from "elysia";
import { requestObservationPlugin } from "@shared/http/stacks";
import { auth } from ".";
import {
  AUTH_CAPABILITIES_HEADER,
  getAuthCapabilities,
  serializeAuthCapabilities,
} from "./capabilities";
import { hydrateStoredLocation } from "./location";

function withForwardedForHeader(request: Request, ipAddress?: string) {
  const headers = new Headers(request.headers);
  if (ipAddress) {
    headers.set("X-Forwarded-For", ipAddress);
  }
  return headers;
}

function withAuthCapabilities(response: Response) {
  const headers = new Headers(response.headers);
  headers.set(AUTH_CAPABILITIES_HEADER, serializeAuthCapabilities(getAuthCapabilities()));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleAuthRequest(request: Request, ipAddress?: string) {
  const headers = withForwardedForHeader(request, ipAddress);
  const response = await auth.handler(new Request(request, { headers }));
  return withAuthCapabilities(response);
}

export const authRoutes = new Elysia({
  name: "kyomi.auth.routes",
})
  .use(requestObservationPlugin)
  .get("/api/auth/list-sessions", async (ctx) => {
    const headers = withForwardedForHeader(
      ctx.request,
      ctx.server?.requestIP(ctx.request)?.address,
    );
    const sessions = await auth.api.listSessions({ headers });
    return sessions.map((session) => hydrateStoredLocation(session));
  })
  .all(
    "/api/auth",
    (ctx) => handleAuthRequest(ctx.request, ctx.server?.requestIP(ctx.request)?.address),
    { parse: "none" },
  )
  .all(
    "/api/auth/*",
    (ctx) => handleAuthRequest(ctx.request, ctx.server?.requestIP(ctx.request)?.address),
    { parse: "none" },
  );
