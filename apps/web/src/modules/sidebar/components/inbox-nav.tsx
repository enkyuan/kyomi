"use client";

import { Link } from "@tanstack/react-router";
import { cn } from "@lib/utils";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@vols.rss/ui/sidebar";
import { SidebarModeAnimatedText } from "@vols.rss/ui/sidebar/mode-animated-text";
import type { SidebarInboxCounts } from "../lib/navigation";
import { useInboxNav } from "../hooks/use-inbox-nav";

export function InboxNav({ counts }: { counts: SidebarInboxCounts }) {
  const { badgeValues, isItemActive, items, prefetchNavItem } = useInboxNav(counts);

  return (
    <SidebarGroup className="gap-1">
      <SidebarGroupLabel>
        <SidebarModeAnimatedText>Inbox</SidebarModeAnimatedText>
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const badgeValue = badgeValues[item.label] ?? 0;

          return (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                className={cn(badgeValue > 0 ? "pe-10" : undefined)}
                onFocus={() => {
                  prefetchNavItem(item.search);
                }}
                onPointerEnter={(event) => {
                  if (event.pointerType === "mouse" || event.pointerType === "pen") {
                    prefetchNavItem(item.search);
                  }
                }}
                isActive={isItemActive(item)}
                tooltip={item.label}
                render={
                  <Link
                    to="/inbox"
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
