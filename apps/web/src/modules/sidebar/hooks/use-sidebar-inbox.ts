"use client";

import { useQuery } from "@tanstack/react-query";
import { useTimezone } from "@hooks/use-timezone";
import { useInboxScope } from "@hooks/use-inbox-scope";
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
