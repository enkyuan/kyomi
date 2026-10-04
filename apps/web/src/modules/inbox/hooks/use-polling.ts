"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { hasActiveFeedRefresh } from "../queries/options";
import { queryKeys } from "@lib/query/keys";

export function usePolling(feeds: readonly { refreshStatus?: string | null }[] | null | undefined) {
  const queryClient = useQueryClient();
  const wasRefreshingFollowedFeedRef = useRef(false);
  const hasRefreshingFollowedFeed = hasActiveFeedRefresh(feeds);

  useEffect(() => {
    if (wasRefreshingFollowedFeedRef.current === hasRefreshingFollowedFeed) {
      return;
    }

    wasRefreshingFollowedFeedRef.current = hasRefreshingFollowedFeed;

    void queryClient.invalidateQueries({ queryKey: queryKeys.inbox.items });
    void queryClient.invalidateQueries({ queryKey: queryKeys.sidebar.inboxSummary });
  }, [hasRefreshingFollowedFeed, queryClient]);
}
