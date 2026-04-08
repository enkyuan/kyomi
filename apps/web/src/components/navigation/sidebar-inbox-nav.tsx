"use client";

import { useLocation, Link } from "@tanstack/react-router";
import { Calendar3Fill, NewsFill, StarFill } from "@mingcute/react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
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

export function SidebarInboxNav({ unreadCount }: { unreadCount: number }) {
  const location = useLocation();

  return (
    <SidebarGroup className="gap-1">
      <SidebarGroupLabel>Inbox</SidebarGroupLabel>
      <SidebarMenu>
        {INBOX_NAV.map((item) => (
          <SidebarMenuItem key={item.label}>
            <SidebarMenuButton
              activeAdornment={
                item.label === "Today" && unreadCount > 0 ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-sidebar-foreground/10 px-1 text-[11px] font-semibold text-sidebar-foreground tabular-nums">
                    {unreadCount}
                  </span>
                ) : null
              }
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
              <span>{item.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
