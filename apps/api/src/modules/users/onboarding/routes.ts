import type { Elysia } from "elysia";
import type { ManagedRuntime } from "effect";
import { CANONICAL_CATEGORY_LABELS } from "@kyomi/db";
import type { Db } from "@adapters/db/service";
import { runEffect } from "@shared/http/effect/bridge";
import { v1EffectContext } from "@shared/http/v1/context";
import { starterBundles as bundles } from "@kyomi/ingest/ingestion/starter-bundles";
import { availability, getState, getStatus, save } from "./operations";
import { TakenUsernames } from "./usernames";

export function registerOnboardingRoutes(
  app: Elysia,
  runtime: ManagedRuntime.ManagedRuntime<Db, unknown>,
) {
  const usernames = new TakenUsernames();
  return app.group("/me/onboarding", (group) =>
    group
      .onBeforeHandle(({ set }) => {
        set.headers["cache-control"] = "private, no-store";
      })
      .get("", async (context) => ({
        ...(await runEffect({ runtime, ...v1EffectContext(context) }, getState)),
        options: { categories: CANONICAL_CATEGORY_LABELS, bundles },
      }))
      .get("/status", (context) => runEffect({ runtime, ...v1EffectContext(context) }, getStatus))
      .get("/username", (context) => {
        const ctx = v1EffectContext(context);
        return runEffect({ runtime, ...ctx }, availability(ctx.query.username, usernames));
      })
      .patch("", (context) => {
        const ctx = v1EffectContext(context);
        return runEffect({ runtime, ...ctx }, save({ type: "patch", body: ctx.body }));
      })
      .put("/completion", (context) =>
        runEffect({ runtime, ...v1EffectContext(context) }, save({ type: "complete" })),
      ),
  );
}
