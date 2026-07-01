import { Elysia } from "elysia";
import { auth } from ".";
import { hydrateStoredSessionLocation } from "./session-location";

function withForwardedForHeader(request: Request, ipAddress?: string) {
  const headers = new Headers(request.headers);
  if (ipAddress) {
    headers.set("X-Forwarded-For", ipAddress);
  }
  return headers;
}

export const authRoutes = new Elysia({
  name: "kyomi.auth.routes",
})
  .get("/api/auth/list-sessions", async (ctx) => {
    const headers = withForwardedForHeader(
      ctx.request,
      ctx.server?.requestIP(ctx.request)?.address,
    );
    const sessions = await auth.api.listSessions({ headers });
    return sessions.map((session) => hydrateStoredSessionLocation(session));
  })
  .all("/api/auth", (ctx) => {
    const headers = withForwardedForHeader(
      ctx.request,
      ctx.server?.requestIP(ctx.request)?.address,
    );
    return auth.handler(new Request(ctx.request, { headers }));
  })
  .all("/api/auth/*", (ctx) => {
    const headers = withForwardedForHeader(
      ctx.request,
      ctx.server?.requestIP(ctx.request)?.address,
    );
    return auth.handler(new Request(ctx.request, { headers }));
  });
