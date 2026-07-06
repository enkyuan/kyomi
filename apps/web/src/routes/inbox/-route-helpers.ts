import type { QueryClient } from "@tanstack/react-query";
import { requireAuth } from "@/routes/-guards";
import { listFollowedFeeds } from "@modules/feeds/lib/api";
import { getInboxItemIdFromSlug } from "@modules/inbox/lib/articles/slug";
import { followedFeedsQueryKey, inboxDetailQueryOptions } from "@modules/inbox/queries/options";
import { getInboxLoaderData } from "@modules/inbox/lib/route";
import type { InboxFilter, InboxSort } from "@modules/inbox/lib/articles/index";
import { QUERY_TIMES } from "@lib/query/policies";

export type InboxSearch = {
  filter?: InboxFilter;
  search?: string;
  feedId?: string;
  folderId?: string;
  itemId?: string;
  showHidden?: "1";
  showRead?: "1";
  sort?: InboxSort;
};

export type InboxLoaderData = Awaited<ReturnType<typeof getInboxLoaderData>>;

type InboxRouteLoaderArgs = {
  context: {
    queryClient: QueryClient;
  };
  params?: {
    article?: string;
  };
};

function parseOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function validateInboxSearch(search: Record<string, unknown>): InboxSearch {
  const filter = (() => {
    if (search.filter === "inbox" || search.filter === "today" || search.filter === "unread") {
      return "my-feed";
    }
    if (
      search.filter === "my-feed" ||
      search.filter === "all" ||
      search.filter === "saved" ||
      search.filter === "recent"
    ) {
      return search.filter;
    }
    return undefined;
  })();

  const sort = search.sort === "newest" || search.sort === "oldest" ? search.sort : undefined;

  return {
    filter,
    search: parseOptionalString(search.search),
    feedId: parseOptionalString(search.feedId),
    folderId: parseOptionalString(search.folderId),
    itemId: parseOptionalString(search.itemId),
    showHidden: search.showHidden === "1" ? "1" : undefined,
    showRead: search.showRead === "1" ? "1" : undefined,
    sort,
  };
}

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
    requireAuth(),
    getInboxLoaderData(),
    followedFeedsPrefetch,
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
