import type { Elysia } from "elysia";
import type { ManagedRuntime } from "effect";
import type { Db } from "@adapters/db/service";
import { registerInboxRecapRoutes } from "./recap/routes";

export function registerInboxRoutes(
  app: Elysia,
  runtime: ManagedRuntime.ManagedRuntime<Db, unknown>,
) {
  return registerInboxRecapRoutes(app, runtime);
}
