import { listFolders } from "@modules/folders/api";
import { listFollowedFeeds } from "@modules/feeds/api";
import { getSidebarInboxCounts } from "@modules/inbox/services/api";
import { followedFeedsQueryKey } from "@modules/inbox/queries/options";
import { QUERY_TIMES } from "@lib/query/policies";

function foldersQueryKey() {
  return ["folders"] as const;
}

export function foldersQueryOptions() {
  return {
    queryKey: foldersQueryKey(),
    queryFn: () => listFolders(),
    staleTime: QUERY_TIMES.staticMetadataStale,
    gcTime: QUERY_TIMES.staticMetadataGc,
  } as const;
}

export function followedFeedsQueryOptions() {
  return {
    queryKey: followedFeedsQueryKey(),
    queryFn: () => listFollowedFeeds(),
    staleTime: QUERY_TIMES.staticMetadataStale,
    gcTime: QUERY_TIMES.staticMetadataGc,
  } as const;
}

function sidebarInboxCountsQueryKey(
  timezoneOffsetMinutes: number | undefined,
  feedId?: string,
  folderId?: string,
) {
  return ["sidebar", "inbox-summary", timezoneOffsetMinutes, feedId, folderId] as const;
}

export function sidebarInboxCountsQueryOptions({
  timezoneOffsetMinutes,
  feedId,
  folderId,
}: {
  timezoneOffsetMinutes: number | undefined;
  feedId?: string;
  folderId?: string;
}) {
  return {
    queryKey: sidebarInboxCountsQueryKey(timezoneOffsetMinutes, feedId, folderId),
    enabled: timezoneOffsetMinutes !== undefined,
    queryFn: () =>
      getSidebarInboxCounts({
        data: { timezoneOffsetMinutes: timezoneOffsetMinutes!, feedId, folderId },
      }),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  } as const;
}
