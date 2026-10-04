import { listFollowedFeeds } from "@modules/feeds/lib/api";
import { QUERY_TIMES } from "@lib/query/policies";
import { queryKeys } from "@lib/query/keys";

export function followedFeedsQueryOptions() {
  return {
    queryKey: queryKeys.feeds.followed,
    queryFn: () => listFollowedFeeds(),
    staleTime: QUERY_TIMES.staticMetadataStale,
    gcTime: QUERY_TIMES.staticMetadataGc,
  } as const;
}
