"use client";

import { useState } from "react";
import { DownFill } from "@mingcute/react";
import { Link, useLocation, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FeedFavicon } from "@components/navigation/feed-favicon";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@components/ui/collapsible";
import { listFollowedFeeds, type FollowedFeed } from "@modules/feeds/api";
import { isInboxPathname } from "@lib/routes/inbox-path";
import { usePinnedFeedIds } from "@modules/feeds/use-pins";
import { QUERY_TIMES } from "@lib/query-policies";
import { prefetchInboxFlow } from "@modules/inbox/prefetch";
import {
  SidebarGroup,
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const isInbox = isInboxPathname(location.pathname);
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const followedFeedsQuery = useQuery({
    queryKey: ["feeds", "followed"],
    queryFn: () => listFollowedFeeds(),
    staleTime: QUERY_TIMES.staticMetadataStale,
    gcTime: QUERY_TIMES.staticMetadataGc,
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
          <SidebarMenu>
            {pinnedFeeds.length === 0 ? (
              <SidebarMenuItem className="list-none">
                <p className="flex h-8 items-center px-2 text-sm text-muted-foreground/75">
                  <span className="truncate">No pinned feeds yet</span>
                </p>
              </SidebarMenuItem>
            ) : (
              pinnedFeeds.map((feed) => (
                <SidebarMenuItem key={feed.feedId}>
                  <SidebarMenuButton
                    tooltip={feed.title || feed.url}
                    isActive={isInbox && location.search.feedId === feed.feedId}
                    onFocus={() => {
                      void prefetchInboxFlow(router, queryClient, {
                        filter: "inbox",
                        feedId: feed.feedId,
                      });
                    }}
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse" || event.pointerType === "pen") {
                        void prefetchInboxFlow(router, queryClient, {
                          filter: "inbox",
                          feedId: feed.feedId,
                        });
                      }
                    }}
                    render={
                      <Link
                        to="/inbox"
                        search={() => ({
                          filter: "inbox" as const,
                          search: undefined,
                          feedId: feed.feedId,
                          folderId: undefined,
                          itemId: undefined,
                        })}
                      />
                    }
                  >
                    <FeedFavicon
                      className="size-4 shrink-0 rounded-[3px]"
                      faviconUrl={feed.faviconUrl}
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
        </CollapsiblePanel>
      </Collapsible>
    </SidebarGroup>
  );
}
