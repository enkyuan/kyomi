import type { QueryClient } from "@tanstack/react-query";
import { listFollowedFeeds } from "@modules/feeds/lib/api";
import { getInboxItemIdFromSlug } from "@modules/inbox/lib/articles/slug";
import type { InboxSearch } from "@modules/inbox/lib/search";
import {
  followedFeedsQueryKey,
  inboxDetailQueryOptions,
  prefetchInboxHotQueries,
} from "@modules/inbox/queries/options";
import { getInboxLoaderData } from "@modules/inbox/lib/route";
import { QUERY_TIMES } from "@lib/query/policies";

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
  const followedFeedsPrefetch = queryClient
    .prefetchQuery({
      queryKey: followedFeedsQueryKey(),
      queryFn: () => listFollowedFeeds(),
      staleTime: QUERY_TIMES.staticMetadataStale,
      gcTime: QUERY_TIMES.staticMetadataGc,
    })
    .catch(() => undefined);
  const loaderData = await getInboxLoaderData();
  const hotPrefetch =
    typeof loaderData.initialTimezoneOffsetMinutes === "number"
      ? prefetchInboxHotQueries(queryClient, {
          filter: deps?.filter ?? loaderData.initialInboxPreferences.inboxDefaultView,
          search: deps?.search,
          feedId: deps?.feedId,
          folderId: deps?.folderId,
          itemId: routeItemId,
          sort: deps?.sort,
          timezoneOffsetMinutes: loaderData.initialTimezoneOffsetMinutes,
        }).catch(() => undefined)
      : Promise.resolve();
  const detailPrefetch =
    routeItemId && typeof loaderData.initialTimezoneOffsetMinutes !== "number"
      ? queryClient.prefetchQuery(inboxDetailQueryOptions(routeItemId)).catch(() => undefined)
      : Promise.resolve();

  await Promise.all([followedFeedsPrefetch, hotPrefetch, detailPrefetch]);
  return loaderData;
}

export async function prefetchInboxArticleRoute({ context, params }: InboxRouteLoaderArgs) {
  const routeItemId = getInboxItemIdFromSlug(params?.article);
  if (!routeItemId) {
    return;
  }

  await context.queryClient
    .prefetchQuery(inboxDetailQueryOptions(routeItemId))
    .catch(() => undefined);
}
