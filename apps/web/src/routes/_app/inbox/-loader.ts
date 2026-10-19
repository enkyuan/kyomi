import type { QueryClient } from "@tanstack/react-query";
import { followedFeedsQueryOptions } from "@modules/feeds/queries/options";
import { foldersQueryOptions } from "@modules/folders/queries/options";
import { getInboxItemIdFromSlug } from "@modules/articles/lib/slug";
import type { InboxSearch } from "@modules/inbox/lib/search";
import { prefetchInboxItemDetail, prefetchInboxHotQueries } from "@modules/inbox/queries/options";
import { getInboxLoaderData } from "@modules/inbox/lib/api";

export type InboxLoaderData = Awaited<ReturnType<typeof getInboxLoaderData>>;

type InboxRouteLoaderArgs = {
  context: {
    queryClient: QueryClient;
  };
  params?: {
    article?: string;
  };
  deps?: InboxSearch;
};

export async function loadInboxRoute({ context, params, deps }: InboxRouteLoaderArgs) {
  const queryClient = context.queryClient;
  const routeItemId = getInboxItemIdFromSlug(params?.article);
  void queryClient.prefetchQuery(followedFeedsQueryOptions()).catch(() => undefined);
  void queryClient.prefetchQuery(foldersQueryOptions()).catch(() => undefined);
  const loaderData = await getInboxLoaderData();
  if (typeof loaderData.initialTimezoneOffsetMinutes === "number") {
    void prefetchInboxHotQueries(queryClient, {
      filter: deps?.filter ?? loaderData.initialInboxPreferences.inboxDefaultView,
      search: deps?.search,
      feedId: deps?.feedId,
      folderId: deps?.folderId,
      itemId: routeItemId,
      sort: deps?.sort,
      timezoneOffsetMinutes: loaderData.initialTimezoneOffsetMinutes,
    }).catch(() => undefined);
  }

  if (routeItemId) {
    void prefetchInboxItemDetail(queryClient, routeItemId).catch(() => undefined);
  }

  return loaderData;
}

export async function prefetchInboxArticleRoute({ context, params }: InboxRouteLoaderArgs) {
  const routeItemId = getInboxItemIdFromSlug(params?.article);
  if (!routeItemId) {
    return;
  }

  void prefetchInboxItemDetail(context.queryClient, routeItemId).catch(() => undefined);
}
