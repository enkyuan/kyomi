import { Elysia } from "elysia";
import { requestObservationPlugin } from "@shared/http/stacks";
import { auth } from ".";
import { hydrateStoredLocation } from "./location";

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
    (ctx) => {
      const headers = withForwardedForHeader(
        ctx.request,
        ctx.server?.requestIP(ctx.request)?.address,
      );
      return auth.handler(new Request(ctx.request, { headers }));
    },
    { parse: "none" },
  )
  .all(
    "/api/auth/*",
    (ctx) => {
      const headers = withForwardedForHeader(
        ctx.request,
        ctx.server?.requestIP(ctx.request)?.address,
      );
      return auth.handler(new Request(ctx.request, { headers }));
    },
    { parse: "none" },
  );
