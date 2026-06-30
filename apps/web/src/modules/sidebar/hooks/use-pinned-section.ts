"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FollowedFeed } from "@modules/feeds/api";
import { usePinnedFeedIds } from "@modules/feeds/hooks/use-pinned-feed-ids";
import { followedFeedsQueryOptions } from "../queries/options";
import { useInboxScope } from "@hooks/use-inbox-scope";

export function usePinnedSection() {
  const { isInbox, scopedFeedId } = useInboxScope();
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const { data: followedFeedsData } = useQuery(followedFeedsQueryOptions());
  const { pinnedFeedIds } = usePinnedFeedIds();

  const feedItems = followedFeedsData ?? [];
  const pinnedFeeds = pinnedFeedIds.reduce<FollowedFeed[]>((feeds, feedId) => {
    const feed = feedItems.find((item) => item.feedId === feedId);
    if (feed) {
      feeds.push(feed);
    }
    return feeds;
  }, []);

  return {
    followedFeedsData,
    isInbox,
    pinnedFeeds,
    pinnedOpen,
    scopedFeedId,
    setPinnedOpen,
  };
}
