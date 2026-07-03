import { listFollowedFeeds } from "@modules/feeds/lib/api";
import { followedFeedsQueryKey } from "@modules/inbox/queries/options";
import { QUERY_TIMES } from "@lib/query/policies";

export function followedFeedsQueryOptions() {
  return {
    queryKey: followedFeedsQueryKey(),
    queryFn: () => listFollowedFeeds(),
    staleTime: QUERY_TIMES.staticMetadataStale,
    gcTime: QUERY_TIMES.staticMetadataGc,
  } as const;
}
