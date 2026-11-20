import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { DefaultErrorPage } from "./app/error";
import { DefaultNotFoundPage } from "./app/not-found";
import { captureRouteError } from "@integrations/posthog/capture";
import { startPagePerfReporting } from "@integrations/posthog/perf";

import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getContext } from "@lib/query/client";
import { createSafeHydrate } from "@lib/query/hydration";
import { mark } from "@lib/perf/marks";

export function getRouter() {
  const context = getContext();

  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorPage,
    defaultNotFoundComponent: DefaultNotFoundPage,
    defaultOnCatch: captureRouteError,
  });

  const ogHydrate = router.options.hydrate;
  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });

  // Preserve Kyomi's hydration timing and support snapshots from either side of a rollout.
  router.options.hydrate = createSafeHydrate(
    ogHydrate as ((d: unknown) => Promise<void> | void) | undefined,
    context.queryClient,
  );

  if (typeof window !== "undefined") {
    const stopResolvedMark = router.subscribe("onResolved", () => {
      mark("route-resolved");
      stopResolvedMark();
    });
    startPagePerfReporting({ getRouteId: () => router.state.matches.at(-1)?.routeId });
  }

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
