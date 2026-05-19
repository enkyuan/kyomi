"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { InboxFilter } from "@modules/inbox/services/api";
import { useInboxPreferences } from "@modules/inbox/hooks/use-inbox-preferences";
import { prefetchInboxFlow } from "@modules/inbox/lib/prefetch";
import {
  isInboxNavItemActive,
  resolveInboxNavItems,
  type InboxNavItem,
  type SidebarInboxCounts,
} from "../lib/navigation";
import { useInboxScope } from "@hooks/use-inbox-scope";

export function useInboxNav(counts: SidebarInboxCounts) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { preferences } = useInboxPreferences();
  const { activeFilter, isInbox, locationSearch } = useInboxScope();
  const { badgeValues, items } = resolveInboxNavItems(preferences, counts);

  const prefetchNavItem = (search: InboxNavItem["search"]) => {
    void prefetchInboxFlow(router, queryClient, { filter: search.filter as InboxFilter });
  };

  const isItemActive = (item: InboxNavItem) =>
    isInboxNavItemActive(isInbox, activeFilter, item, locationSearch);

  return {
    badgeValues,
    isItemActive,
    items,
    prefetchNavItem,
  };
}
