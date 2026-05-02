import { Elysia } from "elysia";
import { databaseAdapterPlugin, requestObservationPlugin } from "@shared/http/stacks";
import { buildReadinessPayload, getHealth } from "@modules/health/service";

function liveness() {
  return getHealth();
}

export const healthPlugin = new Elysia({
  name: "cronos.health",
})
  .use(requestObservationPlugin)
  .get("/health", liveness)
  .get("/api/health", liveness)
  .use(databaseAdapterPlugin)
  .get("/ready", async ({ db, set }) => {
    const payload = await buildReadinessPayload(db);
    if (!payload.ready) {
      set.status = 503;
    }
    return payload;
  })
  .get("/api/ready", async ({ db, set }) => {
    const payload = await buildReadinessPayload(db);
    if (!payload.ready) {
      set.status = 503;
    }
    return payload;
  });
