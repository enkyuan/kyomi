import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/routes/-guards";
import { listFollowedFeeds } from "@modules/feeds/api";
import { Page } from "@modules/inbox";
import { followedFeedsQueryKey } from "@modules/inbox/queries/options";
import { getInboxLoaderData } from "@modules/inbox/services/route-loader";
import type { InboxFilter, InboxSort } from "@modules/inbox/services/api";
import { QUERY_TIMES } from "@lib/query/policies";

type InboxSearch = {
  filter?: InboxFilter;
  search?: string;
  feedId?: string;
  folderId?: string;
  itemId?: string;
  showHidden?: "1";
  showRead?: "1";
  sort?: InboxSort;
};

function parseOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function validateInboxSearch(search: Record<string, unknown>): InboxSearch {
  const filter = (() => {
    if (search.filter === "inbox") {
      return "all";
    }
    if (
      search.filter === "all" ||
      search.filter === "today" ||
      search.filter === "unread" ||
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

export const Route = createFileRoute("/inbox/")({
  validateSearch: validateInboxSearch,
  loader: async ({ context }) => {
    const followedFeedsPrefetch = context.queryClient
      .prefetchQuery({
        queryKey: followedFeedsQueryKey(),
        queryFn: () => listFollowedFeeds(),
        staleTime: QUERY_TIMES.staticMetadataStale,
        gcTime: QUERY_TIMES.staticMetadataGc,
      })
      .catch(() => undefined);

    const [, loaderData] = await Promise.all([
      requireAuth(),
      getInboxLoaderData(),
      followedFeedsPrefetch,
    ]);
    return loaderData;
  },
  component: InboxRouteComponent,
});

function InboxRouteComponent() {
  const { initialInboxPreferences, initialSplitPanePercent } = Route.useLoaderData();
  return (
    <Page
      initialInboxPreferences={initialInboxPreferences}
      initialSplitPanePercent={initialSplitPanePercent}
    />
  );
}
