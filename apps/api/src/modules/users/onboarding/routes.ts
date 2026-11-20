import type { Elysia } from "elysia";
import type { ManagedRuntime } from "effect";
import { CANONICAL_CATEGORY_LABELS } from "@kyomi/db";
import type { Db } from "@adapters/db/service";
import { runEffect } from "@shared/http/effect/bridge";
import { v1EffectContext } from "@shared/http/v1/context";
import { bundles } from "./options";
import { availability, getState, save } from "./operations";

export function registerOnboardingRoutes(
  app: Elysia,
  runtime: ManagedRuntime.ManagedRuntime<Db, unknown>,
) {
  return app.group("/me/onboarding", (group) =>
    group
      .onBeforeHandle(({ set }) => {
        set.headers["cache-control"] = "private, no-store";
      })
      .get("", async (context) => ({
        ...(await runEffect({ runtime, ...v1EffectContext(context) }, getState)),
        options: { categories: CANONICAL_CATEGORY_LABELS, bundles },
      }))
      .get("/username", (context) => {
        const ctx = v1EffectContext(context);
        return runEffect({ runtime, ...ctx }, availability(ctx.query.username));
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
