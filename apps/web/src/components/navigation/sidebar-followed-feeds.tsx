"use client";

import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DownFill, NewsFill } from "@mingcute/react";
import { CreateFolderDialog } from "@components/navigation/create-folder-dialog";
import { FeedFavicon } from "@components/navigation/feed-favicon";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@components/ui/collapsible";
import { Menu, MenuItem, MenuPopup } from "@components/ui/menu";
import { toastManager } from "@components/ui/toast";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@components/ui/sidebar";
import { cn } from "@lib/utils";
import {
  type FollowedFeed,
  getFollowedFeedUnreadCounts,
  listFollowedFeeds,
  unfollowFeed,
} from "@lib/feed-functions";
import { isInboxPathname } from "@lib/routes/inbox-path";

export function SidebarFollowedFeeds() {
  const location = useLocation();
  const isInbox = isInboxPathname(location.pathname);
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
    staleTime: 30_000,
    refetchOnWindowFocus: true,
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
                  isActive={isInbox && location.search.feedId === item.feedId}
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
  const queryClient = useQueryClient();
  const feedLabel = item.title || item.url;
  const feedSourceUrl = item.link ?? item.url;

  const unfollowFeedMutation = useMutation({
    mutationFn: ({ feedId }: { feedId: string }) => unfollowFeed({ data: { feedId } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["feeds", "followed"] }),
        queryClient.invalidateQueries({ queryKey: ["feeds", "followed", "unread-counts"] }),
        queryClient.invalidateQueries({ queryKey: ["sidebar", "inbox-summary"] }),
      ]);
      setMenuOpen(false);
      toastManager.add({
        title: "Feed unfollowed",
        description: feedLabel,
        type: "success",
      });
    },
    onError: (error) => {
      toastManager.add({
        title: "Unable to unfollow feed",
        description: error instanceof Error ? error.message : "Try again in a moment.",
        type: "error",
      });
    },
  });

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
            search={() => ({
              filter: "today" as const,
              search: undefined,
              feedId: item.feedId,
              folderId: undefined,
              itemId: undefined,
            })}
          />
        }
      >
        <FeedFavicon
          className="size-4 overflow-hidden rounded-[3px]"
          faviconUrl={item.faviconUrl}
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
                window.open(feedSourceUrl, "_blank", "noopener,noreferrer");
                setMenuOpen(false);
              }}
            >
              Open source website
            </MenuItem>
            <MenuItem
              onClick={() => {
                if (!navigator.clipboard?.writeText) {
                  toastManager.add({
                    title: "Unable to copy feed URL",
                    description: "Clipboard access is unavailable in this browser.",
                    type: "error",
                  });
                  setMenuOpen(false);
                  return;
                }

                void navigator.clipboard.writeText(item.url).then(
                  () => {
                    toastManager.add({
                      title: "Feed URL copied",
                      description: item.url,
                      type: "success",
                    });
                    setMenuOpen(false);
                  },
                  (error: unknown) => {
                    toastManager.add({
                      title: "Unable to copy feed URL",
                      description:
                        error instanceof Error ? error.message : "Copy the URL manually instead.",
                      type: "error",
                    });
                    setMenuOpen(false);
                  },
                );
              }}
            >
              Copy feed URL
            </MenuItem>
            <MenuItem
              variant="destructive"
              disabled={unfollowFeedMutation.isPending}
              onClick={() => {
                if (unfollowFeedMutation.isPending) {
                  return;
                }
                unfollowFeedMutation.mutate({ feedId: item.feedId });
              }}
            >
              {unfollowFeedMutation.isPending ? "Unfollowing..." : "Unfollow feed"}
            </MenuItem>
          </MenuPopup>
        ) : null}
      </Menu>
    </SidebarMenuItem>
  );
}
