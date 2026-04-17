"use client";

import { useState } from "react";
import { DownFill } from "@mingcute/react";
import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FeedFavicon } from "@components/navigation/feed-favicon";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@components/ui/collapsible";
import { listFollowedFeeds, type FollowedFeed } from "@lib/feed-functions";
import { usePinnedFeedIds } from "@hooks/use-pinned-feed-ids";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@components/ui/sidebar";
import { cn } from "@lib/utils";

function isFollowedFeed(value: FollowedFeed | undefined): value is FollowedFeed {
  return Boolean(value);
}

export function SidebarPinnedSection() {
  const location = useLocation();
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const followedFeedsQuery = useQuery({
    queryKey: ["feeds", "followed"],
    queryFn: () => listFollowedFeeds(),
  });
  const { pinnedFeedIds } = usePinnedFeedIds();
  const feedItems = followedFeedsQuery.data ?? [];
  const pinnedFeeds = pinnedFeedIds
    .map((feedId) => feedItems.find((feed) => feed.feedId === feedId))
    .filter(isFollowedFeed);

  return (
    <SidebarGroup className="gap-1">
      <Collapsible onOpenChange={setPinnedOpen} open={pinnedOpen}>
        <CollapsibleTrigger className="w-full">
          <SidebarGroupLabel className="w-full cursor-pointer justify-between">
            <span>Pinned</span>
            <DownFill
              className={cn(
                "size-4 transition-transform duration-200",
                !pinnedOpen && "-rotate-90",
              )}
            />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <SidebarGroupContent>
            <SidebarMenu>
              {pinnedFeeds.length === 0 ? (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    disabled
                    className="cursor-default opacity-72"
                    tooltip="No pinned feeds yet"
                  >
                    <span className="truncate">No pinned feeds yet</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                pinnedFeeds.map((feed) => (
                  <SidebarMenuItem key={feed.feedId}>
                    <SidebarMenuButton
                      tooltip={feed.title || feed.url}
                      isActive={
                        location.pathname === "/inbox" && location.search.feedId === feed.feedId
                      }
                      render={
                        <Link
                          to="/inbox"
                          search={(prev) => ({
                            ...prev,
                            filter: "unread",
                            feedId: feed.feedId,
                            folderId: undefined,
                            itemId: undefined,
                          })}
                        />
                      }
                    >
                      <FeedFavicon
                        className="size-4 shrink-0 rounded-[3px]"
                        feedUrl={feed.url}
                        siteUrl={feed.link}
                        title={feed.title || feed.url}
                      />
                      <span className="min-w-0 flex-1 truncate">{feed.title || feed.url}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsiblePanel>
      </Collapsible>
    </SidebarGroup>
  );
}
