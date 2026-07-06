import type { QueryClient } from "@tanstack/react-query";
import { listFollowedFeeds } from "@modules/feeds/lib/api";
import { getInboxItemIdFromSlug } from "@modules/inbox/lib/articles/slug";
import { followedFeedsQueryKey, inboxDetailQueryOptions } from "@modules/inbox/queries/options";
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
};

export async function loadInboxRoute({ context, params }: InboxRouteLoaderArgs) {
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
  const detailPrefetch = routeItemId
    ? queryClient.prefetchQuery(inboxDetailQueryOptions(routeItemId)).catch(() => undefined)
    : Promise.resolve();

  const [, loaderData] = await Promise.all([
    followedFeedsPrefetch,
    getInboxLoaderData(),
    detailPrefetch,
  ]);
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
