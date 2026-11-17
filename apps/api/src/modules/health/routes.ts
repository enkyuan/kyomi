import { Elysia } from "elysia";
import type { Effect, ManagedRuntime } from "effect";
import type { Db } from "@adapters/db/service";
import type { AppLogger } from "@adapters/logger/service";
import type { Redis } from "@adapters/redis/service";
import type { AppConfig } from "@config/env/service";
import { effectPlugin } from "@shared/http/effect/plugin";
import { requestObservationPlugin } from "@shared/http/stacks";
import { checkReadiness, getHealth } from "./checks";
import { queueHealth } from "./queue";

type HealthRuntime = ManagedRuntime.ManagedRuntime<Db | AppLogger | Redis | AppConfig, unknown>;
type Run<R> = <A, E>(effect: Effect.Effect<A, E, R>) => Promise<A>;

async function readiness(run: Run<Db | AppLogger>, set: { status?: number | string }) {
  const payload = await run(checkReadiness);
  if (!payload.ready) {
    set.status = 503;
  }
  return payload;
}

export function healthPlugin(runtime: HealthRuntime) {
  return new Elysia({ name: "kyomi.health" })
    .use(requestObservationPlugin(runtime))
    .use(effectPlugin(runtime))
    .get("/health", ({ runEffect }) => runEffect(getHealth))
    .get("/api/health", ({ runEffect }) => runEffect(getHealth))
    .get("/queue/health", ({ runEffect }) => runEffect(queueHealth))
    .get("/api/queue/health", ({ runEffect }) => runEffect(queueHealth))
    .get("/ready", ({ runEffect, set }) => readiness(runEffect, set))
    .get("/api/ready", ({ runEffect, set }) => readiness(runEffect, set));
}
