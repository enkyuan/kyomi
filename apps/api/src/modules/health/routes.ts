import { Elysia } from "elysia";
import { getRedis } from "@adapters/redis";
import { buildQueueHealthSnapshot } from "@app/jobs/queue-health";
import { databaseAdapterPlugin, requestObservationPlugin } from "@shared/http/stacks";
import { buildReadinessPayload, getHealth } from "@modules/health/checks";

function liveness() {
  return getHealth();
}

export const healthPlugin = new Elysia({
  name: "kyomi.health",
})
  .use(requestObservationPlugin)
  .get("/health", liveness)
  .get("/api/health", liveness)
  .get("/queue/health", () => buildQueueHealthSnapshot(getRedis()))
  .get("/api/queue/health", () => buildQueueHealthSnapshot(getRedis()))
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
