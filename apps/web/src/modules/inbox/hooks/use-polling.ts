"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ACTIVE_FEED_REFRESH_POLL_INTERVAL_MS,
  followedFeedsQueryKey,
  hasActiveFeedRefresh,
} from "../queries/options";

export function usePolling(feeds: readonly { refreshStatus?: string | null }[] | null | undefined) {
  const queryClient = useQueryClient();
  const wasRefreshingFollowedFeedRef = useRef(false);
  const hasRefreshingFollowedFeed = hasActiveFeedRefresh(feeds);

  useEffect(() => {
    const refreshInboxConsumers = () => {
      void queryClient.invalidateQueries({ queryKey: followedFeedsQueryKey() });
      void queryClient.invalidateQueries({ queryKey: ["inbox", "items"] });
      void queryClient.invalidateQueries({ queryKey: ["sidebar", "inbox-summary"] });
    };

    if (!hasRefreshingFollowedFeed) {
      if (wasRefreshingFollowedFeedRef.current) {
        wasRefreshingFollowedFeedRef.current = false;
        refreshInboxConsumers();
      }
      return;
    }

    wasRefreshingFollowedFeedRef.current = true;
    refreshInboxConsumers();
    const pollTimer = window.setInterval(
      refreshInboxConsumers,
      ACTIVE_FEED_REFRESH_POLL_INTERVAL_MS,
    );

    return () => window.clearInterval(pollTimer);
  }, [hasRefreshingFollowedFeed, queryClient]);
}
