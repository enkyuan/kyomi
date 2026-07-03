"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FollowedFeed } from "@modules/feeds/lib/api";
import { usePinnedFeedIds } from "@modules/feeds/hooks/use-pinned";
import { followedFeedsQueryOptions } from "../queries/options";

export function usePinnedSection() {
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
    pinnedFeeds,
    pinnedOpen,
    setPinnedOpen,
  };
}
