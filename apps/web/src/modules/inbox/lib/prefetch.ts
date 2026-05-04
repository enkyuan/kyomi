import type { QueryClient } from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";
import { prefetchInboxHotQueries, type InboxQueryScope } from "./query-options";

type InboxPreloadRouter = Pick<AnyRouter, "preloadRoute">;

export async function prefetchInboxFlow(
  router: InboxPreloadRouter,
  queryClient: QueryClient,
  scope: InboxQueryScope = {},
) {
  await Promise.all([
    router.preloadRoute({
      to: "/inbox",
      search: {
        filter: scope.filter ?? "inbox",
        search: scope.search,
        feedId: scope.feedId,
        folderId: scope.folderId,
        itemId: scope.itemId,
      },
    }),
    prefetchInboxHotQueries(queryClient, scope),
  ]);
}
