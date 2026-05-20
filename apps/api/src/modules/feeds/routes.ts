import type { Elysia } from "elysia";
import { registerFeedSubscriptionRoutes } from "./subscription/routes";
import { registerFeedRefreshRoutes } from "./refresh/routes";
import { registerFeedReadRoutes } from "./read/routes";
import { registerFeedAdminRoutes } from "./admin/routes";

export function registerFeedRoutes(app: Elysia) {
  return app
    .use(registerFeedSubscriptionRoutes)
    .use(registerFeedRefreshRoutes)
    .use(registerFeedReadRoutes)
    .use(registerFeedAdminRoutes);
}
