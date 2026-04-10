"use client";

import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { DownFill, NewsFill } from "@mingcute/react";
import { CreateFolderDialog } from "@components/navigation/create-folder-dialog";
import { FeedFavicon } from "@components/navigation/feed-favicon";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@components/ui/collapsible";
import { Menu, MenuItem, MenuPopup } from "@components/ui/menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@components/ui/sidebar";
import { toastManager } from "@components/ui/toast";
import { cn } from "@lib/utils";
import {
  type FollowedFeed,
  getFollowedFeedUnreadCounts,
  listFollowedFeeds,
} from "@lib/feed-functions";

export function SidebarFollowedFeeds() {
  const location = useLocation();
  const [feedsOpen, setFeedsOpen] = useState(true);
  const followedFeedsQuery = useQuery({
    queryKey: ["feeds", "followed"],
    queryFn: () => listFollowedFeeds(),
  });
  const items = followedFeedsQuery.data ?? [];
  const unreadCountsQuery = useQuery({
    queryKey: ["feeds", "followed", "unread-counts", items.map((item) => item.feedId)],
    queryFn: () =>
      getFollowedFeedUnreadCounts({
        data: { feedIds: items.map((item) => item.feedId) },
      }),
    enabled: items.length > 0,
  });
  const unreadCounts = unreadCountsQuery.data ?? {};

  return (
    <SidebarGroup className="gap-1">
      <Collapsible open={feedsOpen} onOpenChange={setFeedsOpen}>
        <CollapsibleTrigger className="w-full" render={<div />}>
          <SidebarGroupLabel className="w-full cursor-pointer justify-between">
            <span>Feeds</span>
            <span className="flex items-center gap-2">
              <CreateFolderDialog />
              <DownFill
                className={cn(
                  "size-4 transition-transform duration-200",
                  !feedsOpen && "-rotate-90",
                )}
              />
            </span>
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <SidebarGroupContent>
            <SidebarMenu>
              {followedFeedsQuery.isLoading ? (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <NewsFill />
                    <span>Loading feeds...</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              {followedFeedsQuery.isError ? (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <NewsFill />
                    <span>Unable to load feeds</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              {!followedFeedsQuery.isLoading &&
              !followedFeedsQuery.isError &&
              items.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <NewsFill />
                    <span>No followed feeds</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : null}
              {items.map((item) => (
                <FollowedFeedMenuItem
                  key={item.feedId}
                  item={item}
                  unreadCount={unreadCounts[item.feedId] ?? 0}
                  isActive={
                    location.pathname === "/inbox" &&
                    location.search.filter === "unread" &&
                    location.search.feedId === item.feedId
                  }
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsiblePanel>
      </Collapsible>
    </SidebarGroup>
  );
}

function FollowedFeedMenuItem({
  item,
  unreadCount,
  isActive,
}: {
  item: FollowedFeed;
  unreadCount: number;
  isActive: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchorPoint, setAnchorPoint] = useState({ x: 0, y: 0 });
  const anchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const closeMenu = () => {
      setMenuOpen(false);
    };

    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);

    return () => {
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [menuOpen]);

  const feedLabel = item.title || item.url;

  return (
    <SidebarMenuItem key={item.feedId}>
      <SidebarMenuButton
        className={unreadCount > 0 ? "pe-10" : undefined}
        onContextMenu={(event) => {
          event.preventDefault();
          setAnchorPoint({ x: event.clientX, y: event.clientY });
          setMenuOpen(true);
        }}
        tooltip={feedLabel}
        isActive={isActive}
        render={
          <Link
            to="/inbox"
            search={(prev) => ({
              ...prev,
              filter: "unread",
              feedId: item.feedId,
              folderId: undefined,
              itemId: undefined,
            })}
          />
        }
      >
        <FeedFavicon
          className="size-4 rounded-sm"
          feedUrl={item.url}
          siteUrl={item.link}
          title={feedLabel}
        />
        <span className="min-w-0 flex-1 truncate">{feedLabel}</span>
      </SidebarMenuButton>
      {unreadCount > 0 ? (
        <SidebarMenuBadge className="right-2 rounded-full bg-sidebar-foreground/10 px-1.5 text-[11px] font-semibold">
          {unreadCount}
        </SidebarMenuBadge>
      ) : null}
      {menuOpen ? (
        <div
          ref={anchorRef}
          aria-hidden="true"
          className="pointer-events-none fixed size-px"
          style={{ left: anchorPoint.x, top: anchorPoint.y }}
        />
      ) : null}
      <Menu open={menuOpen} onOpenChange={setMenuOpen}>
        {anchorRef.current ? (
          <MenuPopup align="start" anchor={anchorRef.current} side="right" sideOffset={6}>
            <MenuItem
              onClick={() => {
                toastManager.add({
                  title: "Marked as essential",
                  description: feedLabel,
                  type: "success",
                });
              }}
            >
              Mark As Essential
            </MenuItem>
            <MenuItem
              onClick={() => {
                toastManager.add({
                  title: "Muted for today",
                  description: feedLabel,
                  type: "success",
                });
              }}
            >
              Mute For Today
            </MenuItem>
            <MenuItem
              onClick={() => {
                toastManager.add({
                  title: "Opened in a thought lane",
                  description: feedLabel,
                  type: "success",
                });
              }}
            >
              Open In Thought Lane
            </MenuItem>
          </MenuPopup>
        ) : null}
      </Menu>
    </SidebarMenuItem>
  );
}
