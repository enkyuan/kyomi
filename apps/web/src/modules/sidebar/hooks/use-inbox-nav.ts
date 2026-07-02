"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import type { InboxFilter } from "@modules/inbox/services/api";
import { prefetchInboxFlow } from "@modules/inbox/lib/navigation";
import {
  isInboxNavItemActive,
  resolveInboxNavItems,
  type InboxNavItem,
  type SidebarInboxCounts,
} from "../lib/navigation";
import { useScope } from "@hooks/use-scope";

export function useInboxNav(counts: SidebarInboxCounts) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeFilter, isInbox, locationSearch } = useScope();
  const { badgeValues, items } = resolveInboxNavItems(counts);

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
