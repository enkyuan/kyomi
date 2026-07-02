import type { Elysia } from "elysia";
import { registerInboxRecapRoutes } from "./recap/routes";

export function registerInboxRoutes(app: Elysia) {
  return registerInboxRecapRoutes(app);
}
