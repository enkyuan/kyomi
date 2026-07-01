"use client";

import type { CSSProperties } from "react";
import { Suspense, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AddFill, Message3Fill, Settings1Fill } from "@mingcute/react";
import { KyomiLogo, PremiumIcon } from "@kyomi/ui/icons";
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
import { FeedFavicon } from "./feed-favicon";

const SettingsDialog = lazyNamed(
  () => import("@modules/settings/components/dialog"),
  "SettingsDialog",
);
const FeedbackDialog = lazyNamed(() => import("@kyomi/ui/feedback-dialog"), "FeedbackDialog");
const SourcesDialog = lazyNamed(
  () => import("@modules/feeds/components/follow/sources-dialog"),
  "SourcesDialog",
);

export function AppSidebar({ className, style }: { className?: string; style?: CSSProperties }) {
  const { platform, settingsOpen, setSettingsOpen } = useAppSidebar();
  const { followedFeedsData } = usePinnedSection();

  const [settingsDialogLoaded, setSettingsDialogLoaded] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sourcesDialogLoaded, setSourcesDialogLoaded] = useState(false);
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

  const preloadSourcesDialog = () => {
    setSourcesDialogLoaded(true);
    void SourcesDialog.preload();
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
        <SidebarMenu className="gap-[17px]">
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              tooltip="Kyomi"
              className="size-11 justify-center rounded-full! p-0 hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0!"
              render={<Link to="/inbox" search={{ filter: "all" as const }} />}
            >
              <KyomiLogo size={24} className="size-auto" />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              tooltip="Add feed"
              variant="secondary"
              className="size-11 justify-center rounded-full! p-0 group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0!"
              onClick={() => {
                preloadSourcesDialog();
                setSourcesOpen(true);
              }}
              onFocus={preloadSourcesDialog}
              onPointerEnter={preloadSourcesDialog}
            >
              <AddFill size={24} />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-0">
        <ScrollArea className="h-auto min-h-0 flex-1 data-has-overflow-y:scroll-mask-y-from-6 **:data-[slot=scroll-area-scrollbar]:hidden">
          <SidebarMenu className="items-center gap-3 px-1">
            {feeds.map((feed) => (
              <SidebarMenuItem key={feed.feedId} className="flex justify-center">
                <SidebarMenuButton
                  tooltip={feed.title || feed.url}
                  variant="secondary"
                  className="size-11 justify-center rounded-full! p-0 group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0!"
                >
                  <FeedFavicon
                    className="size-11 shrink-0 rounded-full"
                    faviconUrl={feed.faviconUrl}
                    feedUrl={feed.url}
                    showLoadingSkeleton
                    siteUrl={feed.link}
                    title={feed.title || feed.url}
                  />
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="items-center px-0 pb-[18px] pt-[18px]">
        <SidebarMenu className="items-center gap-3">
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              tooltip="Upgrade Plan"
              variant="secondary"
              className="size-11 justify-center rounded-full! p-0 group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0!"
              disabled
            >
              <PremiumIcon width={24} height={24} />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              tooltip="Feedback"
              variant="secondary"
              className="size-11 justify-center rounded-full! p-0 group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0!"
              onClick={() => {
                preloadFeedbackDialog();
                setFeedbackOpen(true);
              }}
              onFocus={preloadFeedbackDialog}
              onPointerEnter={preloadFeedbackDialog}
            >
              <Message3Fill size={24} />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              tooltip="Settings"
              variant="secondary"
              className="size-11 justify-center rounded-full! p-0 group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0!"
              onClick={() => {
                setSettingsDialogLoaded(true);
                void SettingsDialog.preload();
                setSettingsOpen(true);
              }}
            >
              <Settings1Fill size={24} />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <Suspense fallback={null}>
        {settingsDialogLoaded ? (
          <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        ) : null}
        {sourcesDialogLoaded ? (
          <SourcesDialog
            enableGlobalShortcut={false}
            hideTrigger
            open={sourcesOpen}
            onOpenChange={setSourcesOpen}
            platform={platform}
          />
        ) : null}
        {feedbackDialogLoaded ? (
          <FeedbackDialog hideTrigger open={feedbackOpen} onOpenChange={setFeedbackOpen} />
        ) : null}
      </Suspense>
    </Sidebar>
  );
}
