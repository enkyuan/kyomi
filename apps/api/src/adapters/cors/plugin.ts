import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import type { Env } from "@config/env/runtime";

/** Credentialed CORS for the web app's origin. */
export function corsPlugin(config: Pick<Env, "WEB_ORIGIN">) {
  return new Elysia({
    name: "cors.plugin",
  }).use(
    cors({
      origin: config.WEB_ORIGIN,
      credentials: true,
    }),
  );
}
