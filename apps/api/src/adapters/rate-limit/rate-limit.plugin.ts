import { Elysia } from "elysia";

export const rateLimitPlugin = new Elysia({
  name: "rate-limit.plugin",
}).decorate("rateLimitEnabled", false);
