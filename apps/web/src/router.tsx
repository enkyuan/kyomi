import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getContext } from "@lib/query/client";
import { createSafeHydrate } from "@lib/ssr-query-hydration";

export function getRouter() {
  const context = getContext();

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  // Capture the original hydrate (default: undefined) before the SSR query
  // integration replaces router.options.hydrate with its own buggy version.
  const ogHydrate = router.options.hydrate;

  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });

  // Override the hydrate function set by setupRouterSsrQueryIntegration with a
  // corrected version that checks `done` before calling hydrate() on the
  // stream reader. The upstream implementation crashes with
  // "Cannot read properties of undefined (reading 'mutations')" when the
  // ReadableStream ends and value is undefined.
  router.options.hydrate = createSafeHydrate(
    ogHydrate as ((d: unknown) => Promise<void> | void) | undefined,
    context.queryClient,
  );

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
