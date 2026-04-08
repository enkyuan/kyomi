import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";
import { env } from "@config/env";

export const corsPlugin = new Elysia({
  name: "cors.plugin",
}).use(
  cors({
    origin: env.WEB_ORIGIN,
    credentials: true,
  }),
);
