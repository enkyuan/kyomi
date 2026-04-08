import { Elysia } from "elysia";
import { auth } from "./auth";

export const authRoutes = new Elysia({
  name: "cronos.auth.routes",
})
  .all("/api/auth", ({ request }) => auth.handler(request))
  .all("/api/auth/*", ({ request }) => auth.handler(request));
