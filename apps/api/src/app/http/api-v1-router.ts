import { Elysia } from "elysia";
import { registerArticleRoutes } from "@modules/articles/routes";
import { registerDiscoverRoutes } from "@modules/discover/routes";
import { registerFeedRoutes } from "@modules/feeds/routes";
import { registerFolderRoutes } from "@modules/folders/routes";
import { registerOpmlRoutes } from "@modules/opml/routes";
import { registerQueueRoutes } from "@modules/queue/routes";
import { registerUserRoutes } from "@modules/users/routes";
import { apiV1AdapterPlugin } from "@shared/http/stacks";
import { resolveSessionContext } from "@shared/http/session/context";

const domainRouteRegistrars = [
  registerDiscoverRoutes,
  registerFolderRoutes,
  registerUserRoutes,
  registerArticleRoutes,
  registerFeedRoutes,
  registerOpmlRoutes,
  registerQueueRoutes,
] as const;

function applyDomainRoutes(app: Elysia): Elysia {
  let current = app;
  for (const register of domainRouteRegistrars) {
    current = register(current) as unknown as Elysia;
  }
  return current;
}

/**
 * Versioned JSON API (`/api/v1/...`): shared adapters, session context, then domain routers.
 * Route order matches stable URL semantics (discovery → identity → content → feeds → imports).
 */
export const apiV1Router = new Elysia({
  name: "kyomi.api.v1",
})
  .use(apiV1AdapterPlugin)
  .group("/api/v1", (group) => {
    const authenticated = group.derive(async ({ request, set }) =>
      resolveSessionContext(request, set),
    );
    return applyDomainRoutes(authenticated as unknown as Elysia) as unknown as typeof authenticated;
  });
