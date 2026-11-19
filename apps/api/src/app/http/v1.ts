import { Elysia } from "elysia";
import { resolveSessionContext } from "@adapters/auth/session";
import { registerArticleRoutes } from "@modules/articles/routes";
import { registerDiscoverRoutes } from "@modules/discover/routes";
import { registerFeedRoutes } from "@modules/feeds/routes";
import { registerFolderRoutes } from "@modules/folders/routes";
import { registerInboxRoutes } from "@modules/inbox/routes";
import { registerOpmlRoutes } from "@modules/opml/routes";
import { registerQueueRoutes } from "@modules/queue/routes";
import { registerUserRoutes } from "@modules/users/routes";
import { requestObservationPlugin } from "@shared/http/stacks";
import type { AppRuntime } from "../runtime";
import { largeBodyAuthPlugin } from "../setup/request-guard";

/**
 * Domain registrars in route order (discovery → identity → content → feeds → imports). A registrar
 * that has moved to Effect takes the runtime as its second argument; the rest ignore it.
 */
const domainRouteRegistrars = [
  registerDiscoverRoutes,
  registerFolderRoutes,
  registerUserRoutes,
  registerArticleRoutes,
  registerInboxRoutes,
  registerFeedRoutes,
  registerOpmlRoutes,
  registerQueueRoutes,
] as const;

function applyDomainRoutes(app: Elysia, runtime: AppRuntime): Elysia {
  let current = app;
  for (const register of domainRouteRegistrars) {
    current = register(current, runtime) as unknown as Elysia;
  }
  return current;
}

/** Versioned JSON API (`/api/v1/...`): shared adapters, session context, then domain routers. */
export function createApiV1Router(runtime: AppRuntime) {
  return new Elysia({
    name: "kyomi.api.v1",
  })
    .use(requestObservationPlugin(runtime))
    .use(largeBodyAuthPlugin((request, set) => resolveSessionContext(runtime, request, set)))
    .group("/api/v1", (group) => {
      const authenticated = group.derive(async ({ request, set }) =>
        resolveSessionContext(runtime, request, set),
      );
      return applyDomainRoutes(
        authenticated as unknown as Elysia,
        runtime,
      ) as unknown as typeof authenticated;
    });
}
