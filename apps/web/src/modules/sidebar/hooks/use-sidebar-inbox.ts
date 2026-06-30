"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTimezone } from "@hooks/use-timezone";
import { useInboxScope } from "@hooks/use-inbox-scope";
import { prefetchInboxFlow } from "@modules/inbox/lib/navigation";
import type { SidebarInboxCounts } from "../lib/navigation";
import { sidebarInboxCountsQueryOptions } from "../queries/options";

const EMPTY_COUNTS: SidebarInboxCounts = { all: 0, today: 0, unread: 0, saved: 0 };

export function useSidebarInboxCounts() {
  const timezoneOffsetMinutes = useTimezone();
  const { scopedFeedId, scopedFolderId } = useInboxScope();
  const { data } = useQuery(
    sidebarInboxCountsQueryOptions({
      timezoneOffsetMinutes,
      feedId: scopedFeedId,
      folderId: scopedFolderId,
    }),
  );

  return {
    counts: data ?? EMPTY_COUNTS,
  };
}

export function useInboxPrefetch() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const prefetchFeed = (feedId: string) => {
    void prefetchInboxFlow(router, queryClient, { filter: "inbox", feedId });
  };

  const prefetchOnFocus = (feedId: string) => () => {
    prefetchFeed(feedId);
  };

  const prefetchOnPointerEnter = (feedId: string) => (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      prefetchFeed(feedId);
    }
  };

  return {
    prefetchFeed,
    prefetchOnFocus,
    prefetchOnPointerEnter,
  };
}
