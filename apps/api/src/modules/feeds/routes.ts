import type { Elysia } from "elysia";
import { registerFeedSubscriptionRoutes } from "./subscription/routes";
import { registerFeedRefreshRoutes } from "./refresh/routes";
import { registerFeedReadRoutes } from "./read/routes";
import { registerFeedAdminRoutes } from "./admin/routes";
import type { FeedsRuntime } from "./runtime";

export function registerFeedRoutes(app: Elysia, runtime: FeedsRuntime) {
  let current = app;
  current = registerFeedSubscriptionRoutes(current, runtime) as unknown as Elysia;
  current = registerFeedRefreshRoutes(current, runtime) as unknown as Elysia;
  current = registerFeedReadRoutes(current, runtime) as unknown as Elysia;
  current = registerFeedAdminRoutes(current, runtime) as unknown as Elysia;
  return current;
}
