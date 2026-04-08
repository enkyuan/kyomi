import { Elysia } from "elysia";
import { registerArticleRoutes } from "@modules/articles/articles.routes";
import { registerDiscoverRoutes } from "@modules/discover/discover.routes";
import { registerFeedRoutes } from "@modules/feeds/feeds.routes";
import { registerFolderRoutes } from "@modules/folders/folders.routes";
import { registerOpmlRoutes } from "@modules/opml/opml.routes";
import { registerUserRoutes } from "@modules/users/users.routes";
import { apiV1AdapterPlugin } from "@shared/http/stacks";
import { resolveSessionContext } from "@shared/http/session-context.middleware";

const domainRouteRegistrars = [
  registerDiscoverRoutes,
  registerFolderRoutes,
  registerUserRoutes,
  registerArticleRoutes,
  registerFeedRoutes,
  registerOpmlRoutes,
] as const;

/**
 * Versioned JSON API (`/api/v1/...`): shared adapters, session context, then domain routers.
 * Route order matches stable URL semantics (discovery → identity → content → feeds → imports).
 */
export const apiV1Router = new Elysia({
  name: "cronos.api.v1",
})
  .use(apiV1AdapterPlugin)
  .group("/api/v1", (group) => {
    const authenticated = group.derive(async ({ request, set }) =>
      resolveSessionContext(request, set),
    );
    let app = authenticated as unknown as Elysia;
    for (const register of domainRouteRegistrars) {
      app = register(app) as unknown as Elysia;
    }
    return app as unknown as typeof authenticated;
  });
