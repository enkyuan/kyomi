import { Elysia } from "elysia";
import { auth } from ".";

export const authRoutes = new Elysia({
  name: "kyomi.auth.routes",
})
  .all("/api/auth", (ctx) => {
    const ip = ctx.server?.requestIP(ctx.request)?.address;
    const headers = new Headers(ctx.request.headers);
    if (ip) {
      headers.set("X-Forwarded-For", ip);
    }
    return auth.handler(new Request(ctx.request, { headers }));
  })
  .all("/api/auth/*", (ctx) => {
    const ip = ctx.server?.requestIP(ctx.request)?.address;
    const headers = new Headers(ctx.request.headers);
    if (ip) {
      headers.set("X-Forwarded-For", ip);
    }
    return auth.handler(new Request(ctx.request, { headers }));
  });
