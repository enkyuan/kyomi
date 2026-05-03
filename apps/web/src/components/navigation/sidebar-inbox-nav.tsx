"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocation, Link, useRouter } from "@tanstack/react-router";
import { Calendar3Fill, NewsFill, StarFill, TimeDurationFill } from "@mingcute/react";
import { cn } from "@lib/utils";
import { useInboxPreferences } from "@lib/inbox-preferences";
import { prefetchInboxFlow } from "@modules/inbox/prefetch";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@components/ui/sidebar";
import { SidebarModeAnimatedText } from "@components/ui/sidebar-mode-animated-text";
import { isInboxPathname } from "@lib/routes/inbox-path";

type InboxNavSearch = {
  filter?: "today" | "unread" | "saved" | "recent";
};

const BASE_INBOX_NAV: Array<{
  label: string;
  to: "/inbox";
  search: InboxNavSearch;
  icon: typeof Calendar3Fill;
}> = [
  {
    label: "Today",
    to: "/inbox",
    search: { filter: "today" as const },
    icon: Calendar3Fill,
  },
  {
    label: "All Unread",
    to: "/inbox",
    search: { filter: "unread" as const },
    icon: NewsFill,
  },
  {
    label: "Read Later",
    to: "/inbox",
    search: { filter: "saved" as const },
    icon: StarFill,
  },
];

const FILTER_KEYS = ["filter"] as const;

export function SidebarInboxNav({
  counts,
}: {
  counts: { all: number; today: number; unread: number; saved: number };
}) {
  const location = useLocation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { preferences } = useInboxPreferences();
  const isInbox = isInboxPathname(location.pathname);
  const activeFilter = isInbox ? location.search.filter : undefined;
  const inboxNav = preferences.inboxShowRecents
    ? [
        ...BASE_INBOX_NAV,
        {
          label: "Recents",
          to: "/inbox" as const,
          search: { filter: "recent" as const },
          icon: TimeDurationFill,
        },
      ]
    : BASE_INBOX_NAV;
  const badgeValueByLabel: Record<string, number> = {
    Today: counts.today,
    "All Unread": counts.unread,
    "Read Later": counts.saved,
  };

  return (
    <SidebarGroup className="gap-1">
      <SidebarGroupLabel>
        <SidebarModeAnimatedText>Inbox</SidebarModeAnimatedText>
      </SidebarGroupLabel>
      <SidebarMenu>
        {inboxNav.map((item) => {
          const badgeValue = badgeValueByLabel[item.label] ?? 0;

          return (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                className={cn(badgeValue > 0 ? "pe-10" : undefined)}
                onFocus={() => {
                  void prefetchInboxFlow(router, queryClient, item.search);
                }}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse" || event.pointerType === "pen") {
                    void prefetchInboxFlow(router, queryClient, item.search);
                  }
                }}
                isActive={
                  isInbox &&
                  FILTER_KEYS.every((key) => {
                    const expected = item.search[key];
                    const actual = key === "filter" ? activeFilter : location.search[key];
                    return expected === undefined ? actual === undefined : actual === expected;
                  })
                }
                tooltip={item.label}
                render={
                  <Link
                    to={item.to}
                    search={(prev) => ({
                      ...prev,
                      ...item.search,
                      feedId: item.search.filter === "recent" ? undefined : prev.feedId,
                      folderId: item.search.filter === "recent" ? undefined : prev.folderId,
                      search: undefined,
                      itemId: undefined,
                    })}
                  />
                }
              >
                <item.icon />
                <span className="min-w-0 flex-1">
                  <SidebarModeAnimatedText className="truncate">
                    {item.label}
                  </SidebarModeAnimatedText>
                </span>
              </SidebarMenuButton>
              {badgeValue > 0 ? (
                <SidebarMenuBadge>
                  <span>{badgeValue}</span>
                </SidebarMenuBadge>
              ) : null}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
