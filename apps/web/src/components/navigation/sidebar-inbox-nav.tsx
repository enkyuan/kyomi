"use client";

import { useLocation, Link } from "@tanstack/react-router";
import { Calendar3Fill, NewsFill, StarFill } from "@mingcute/react";
import { cn } from "@lib/utils";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@components/ui/sidebar";

type InboxNavSearch = {
  filter?: "today" | "unread" | "saved";
};

const INBOX_NAV: Array<{
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
  counts: { today: number; unread: number; saved: number };
}) {
  const location = useLocation();
  const badgeValueByLabel: Record<string, number> = {
    Today: counts.today,
    "All Unread": counts.unread,
    "Read Later": counts.saved,
  };

  return (
    <SidebarGroup className="gap-1">
      <SidebarGroupLabel>Inbox</SidebarGroupLabel>
      <SidebarMenu>
        {INBOX_NAV.map((item) => {
          const badgeValue = badgeValueByLabel[item.label] ?? 0;

          return (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                className={cn(badgeValue > 0 ? "pe-10" : undefined)}
                isActive={
                  location.pathname === "/inbox" &&
                  FILTER_KEYS.every((key) => {
                    const expected = item.search[key];
                    const actual = location.search[key];
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
                      itemId: undefined,
                    })}
                  />
                }
              >
                <item.icon />
                <span className="truncate">{item.label}</span>
              </SidebarMenuButton>
              {badgeValue > 0 ? (
                <SidebarMenuBadge className="right-2 rounded-full bg-sidebar-foreground/10 px-1.5 text-[11px] font-semibold">
                  {badgeValue}
                </SidebarMenuBadge>
              ) : null}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
