"use client";

import { useLocation } from "@tanstack/react-router";
import { isInboxPathname } from "@modules/inbox/lib/navigation";

export function useScope() {
  const location = useLocation();
  const isInbox = isInboxPathname(location.pathname);

  return {
    isInbox,
    scopedFeedId: isInbox ? location.search.feedId : undefined,
    scopedFolderId: isInbox ? location.search.folderId : undefined,
    locationSearch: location.search,
    activeFilter: isInbox ? location.search.filter : undefined,
  };
}
