"use client";

import { DownFill } from "@mingcute/react";
import { Link } from "@tanstack/react-router";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@kyomi/ui/collapsible";
import { ScrollArea } from "@kyomi/ui/scroll-area";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@kyomi/ui/sidebar";
import { SidebarModeAnimatedText } from "@kyomi/ui/sidebar/mode-animated-text";
import { cn } from "@lib/utils";
import { FeedFavicon } from "./feed-favicon";
import { PINNED_LIST_SCROLL_CLASS } from "../lib/constants";
import { useInboxPrefetch } from "../hooks/use-sidebar-inbox";
import { usePinnedSection } from "../hooks/use-pinned-section";

export function PinnedSection() {
  const { isInbox, pinnedFeeds, pinnedOpen, scopedFeedId, setPinnedOpen } = usePinnedSection();
  const { prefetchOnFocus, prefetchOnPointerEnter } = useInboxPrefetch();

  return (
    <SidebarGroup className="gap-1">
      <Collapsible onOpenChange={setPinnedOpen} open={pinnedOpen}>
        <CollapsibleTrigger className="w-full">
          <SidebarGroupLabel className="w-full cursor-pointer justify-between">
            <SidebarModeAnimatedText>Pinned</SidebarModeAnimatedText>
            <DownFill
              className={cn(
                "size-4 transition-transform duration-200",
                !pinnedOpen && "-rotate-90",
              )}
            />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <ScrollArea
            className={cn(
              PINNED_LIST_SCROLL_CLASS,
              "data-has-overflow-y:scroll-mask-y-from-6 data-has-overflow-x:scroll-mask-x-from-6",
            )}
          >
            <SidebarMenu>
              {pinnedFeeds.length === 0 ? (
                <SidebarMenuItem className="list-none">
                  <p className="flex h-8 items-center px-2 text-sm text-muted-foreground/75 transition-[height,padding,font-size,line-height] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none group-data-[reader-focus-sidebar=true]/sidebar-wrapper:h-9 group-data-[reader-focus-sidebar=true]/sidebar-wrapper:px-2.5 group-data-[reader-focus-sidebar=true]/sidebar-wrapper:text-base group-data-[reader-focus-sidebar=true]/sidebar-wrapper:leading-6">
                    <span className="min-w-0 flex-1">
                      <SidebarModeAnimatedText className="truncate">
                        No pinned feeds yet
                      </SidebarModeAnimatedText>
                    </span>
                  </p>
                </SidebarMenuItem>
              ) : (
                pinnedFeeds.map((feed) => (
                  <SidebarMenuItem key={feed.feedId}>
                    <SidebarMenuButton
                      tooltip={feed.title || feed.url}
                      isActive={isInbox && scopedFeedId === feed.feedId}
                      onFocus={prefetchOnFocus(feed.feedId)}
                      onPointerEnter={prefetchOnPointerEnter(feed.feedId)}
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
                        className="size-4 shrink-0 rounded-[3px] group-data-[reader-focus-sidebar=true]/sidebar-wrapper:size-4.5"
                        faviconUrl={feed.faviconUrl}
                        feedUrl={feed.url}
                        siteUrl={feed.link}
                        title={feed.title || feed.url}
                      />
                      <span className="min-w-0 flex-1">
                        <SidebarModeAnimatedText className="truncate">
                          {feed.title || feed.url}
                        </SidebarModeAnimatedText>
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </ScrollArea>
        </CollapsiblePanel>
      </Collapsible>
    </SidebarGroup>
  );
}
