"use client";

import type { CSSProperties } from "react";
import { Suspense, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AddCircleFill, ArrowUpCircleFill, Chat3Fill, Settings3Fill } from "@mingcute/react";
import { KyomiLogo } from "@kyomi/ui/icons";
import { ScrollArea } from "@kyomi/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@kyomi/ui/sidebar";
import { cn } from "@lib/utils";
import { lazyNamed } from "@lib/lazy-named";
import { APP_SIDEBAR_WIDTH } from "../lib/constants";
import { useAppSidebar } from "../hooks/use-app-sidebar";
import { usePinnedSection } from "../hooks/use-pinned-section";
import { useInboxPrefetch } from "../hooks/use-sidebar-inbox";
import { useInboxScope } from "@hooks/use-inbox-scope";
import { FeedFavicon } from "./feed-favicon";

const SettingsDialog = lazyNamed(
  () => import("@modules/settings/components/dialog"),
  "SettingsDialog",
);
const FeedbackDialog = lazyNamed(() => import("@kyomi/ui/feedback-dialog"), "FeedbackDialog");

export function AppSidebar({ className, style }: { className?: string; style?: CSSProperties }) {
  const { settingsOpen, setSettingsOpen } = useAppSidebar();
  const { followedFeedsData, scopedFeedId } = usePinnedSection();
  const { isInbox } = useInboxScope();
  const { prefetchOnFocus, prefetchOnPointerEnter } = useInboxPrefetch();

  const [settingsDialogLoaded, setSettingsDialogLoaded] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackDialogLoaded, setFeedbackDialogLoaded] = useState(false);

  useEffect(() => {
    if (settingsOpen) {
      setSettingsDialogLoaded(true);
      void SettingsDialog.preload();
    }
  }, [settingsOpen]);

  const preloadFeedbackDialog = () => {
    setFeedbackDialogLoaded(true);
    void FeedbackDialog.preload();
  };

  const feeds = followedFeedsData ?? [];

  return (
    <Sidebar
      side="left"
      variant="inset"
      collapsible="none"
      className={cn("h-svh bg-sidebar", className)}
      style={{ "--sidebar-width": APP_SIDEBAR_WIDTH, ...style } as CSSProperties}
    >
      <SidebarHeader className="items-center px-0 pt-[18px] pb-[18px]">
        <SidebarMenu>
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              tooltip="Kyomi"
              className="size-11 justify-center rounded-full! p-0 hover:bg-transparent active:bg-transparent"
              render={<Link to="/inbox" search={{ filter: "all" as const }} />}
            >
              <KyomiLogo size={24} className="size-auto" />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              tooltip="Add feed"
              className="size-11 justify-center rounded-full! p-0 hover:bg-transparent active:bg-transparent"
            >
              <AddCircleFill className="size-6" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-0">
        <ScrollArea className="h-auto min-h-0 flex-1 data-has-overflow-y:scroll-mask-y-from-6 **:data-[slot=scroll-area-scrollbar]:hidden">
          <SidebarMenu className="items-center gap-3 px-1">
            {feeds.map((feed) => {
              const isActive = isInbox && scopedFeedId === feed.feedId;
              return (
                <SidebarMenuItem key={feed.feedId} className="flex justify-center">
                  <SidebarMenuButton
                    tooltip={feed.title || feed.url}
                    className="size-11 justify-center rounded-full! p-0 hover:bg-transparent active:bg-transparent"
                    isActive={isActive}
                    onFocus={prefetchOnFocus(feed.feedId)}
                    onPointerEnter={prefetchOnPointerEnter(feed.feedId)}
                    render={
                      <Link
                        to="/inbox"
                        search={() => ({
                          filter: "all" as const,
                          search: undefined,
                          feedId: feed.feedId,
                          folderId: undefined,
                          itemId: undefined,
                        })}
                      />
                    }
                  >
                    <FeedFavicon
                      className="size-6 shrink-0 rounded-[3px]"
                      faviconUrl={feed.faviconUrl}
                      feedUrl={feed.url}
                      siteUrl={feed.link}
                      title={feed.title || feed.url}
                    />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="items-center px-0 pb-[18px] pt-[18px]">
        <SidebarMenu className="items-center gap-3">
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              tooltip="Upgrade Plan"
              className="size-11 justify-center rounded-full! p-0 opacity-72 hover:bg-transparent active:bg-transparent"
              disabled
            >
              <ArrowUpCircleFill className="size-6" />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              tooltip="Feedback"
              className="size-11 justify-center rounded-full! p-0 opacity-72 hover:bg-transparent active:bg-transparent"
              onClick={() => {
                preloadFeedbackDialog();
                setFeedbackOpen(true);
              }}
              onFocus={preloadFeedbackDialog}
              onPointerEnter={preloadFeedbackDialog}
            >
              <Chat3Fill className="size-6" />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              tooltip="Settings"
              className="size-11 justify-center rounded-full! p-0 opacity-72 hover:bg-transparent active:bg-transparent"
              onClick={() => {
                setSettingsDialogLoaded(true);
                void SettingsDialog.preload();
                setSettingsOpen(true);
              }}
            >
              <Settings3Fill className="size-6" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <Suspense fallback={null}>
        {settingsDialogLoaded ? (
          <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        ) : null}
        {feedbackDialogLoaded ? (
          <FeedbackDialog hideTrigger open={feedbackOpen} onOpenChange={setFeedbackOpen} />
        ) : null}
      </Suspense>
    </Sidebar>
  );
}
