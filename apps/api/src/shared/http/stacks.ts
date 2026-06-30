import { Elysia } from "elysia";
import { dbPlugin } from "@adapters/db/plugin";
import { loggingMiddleware } from "@shared/http/logging/middleware";
import { requestIdMiddleware } from "@shared/http/request-id/middleware";

/** Request correlation id + structured access logging (no persistence adapters). */
export const requestObservationPlugin = new Elysia({ name: "kyomi.http.observation" })
  .use(requestIdMiddleware)
  .use(loggingMiddleware);

/** Drizzle + `pg` pool on context (`db`, `pool`). */
export const databaseAdapterPlugin = new Elysia({ name: "kyomi.adapters.database" }).use(dbPlugin);

/**
 * Default stack for `/api/v1` before route handlers: observation + database
 * (session resolution runs inside the versioned group).
 */
export const apiV1AdapterPlugin = new Elysia({ name: "kyomi.api.v1.adapters" })
  .use(requestObservationPlugin)
  .use(databaseAdapterPlugin);
