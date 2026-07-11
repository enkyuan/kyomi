import type { QueryClient } from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";
import { prefetchInboxHotQueries, type InboxQueryScope } from "../queries/options";

const DEFAULT_INBOX_FILTER = "all" as const;

type InboxPreloadRouter = Pick<AnyRouter, "preloadRoute">;

/** Whether the pathname is the inbox route (trailing slashes ignored). */
export function isInboxPathname(pathname: string): boolean {
  return pathname.replace(/\/+$/, "") === "/inbox";
}

export async function prefetchInboxFlow(
  router: InboxPreloadRouter,
  queryClient: QueryClient,
  scope: InboxQueryScope = {},
) {
  const resolvedScope = {
    ...scope,
    filter: scope.filter ?? DEFAULT_INBOX_FILTER,
  };

  await Promise.all([
    router.preloadRoute({
      to: "/inbox",
      search: {
        filter: resolvedScope.filter,
        search: resolvedScope.search,
        feedId: resolvedScope.feedId,
        folderId: resolvedScope.folderId,
        itemId: resolvedScope.itemId,
        sort: resolvedScope.sort,
      },
    }),
    prefetchInboxHotQueries(queryClient, resolvedScope),
  ]);
}
