"use client";

import type { CSSProperties } from "react";
import { Suspense, useEffect, useReducer } from "react";
import { Link } from "@tanstack/react-router";
import { AddFill, Settings1Fill } from "@mingcute/react";
import { KyomiLogo, PremiumIcon } from "@kyomi/ui/icons";
import { ScrollArea } from "@kyomi/ui/scroll-area";
import {
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@kyomi/ui/sidebar";
import { cn } from "@kyomi/ui/lib/utils";
import { lazyNamed } from "@lib/lazy-named";
import { useScope } from "@hooks/use-scope";
import { INBOX_PREVIOUS_FEED_ID_STATE_KEY } from "@modules/inbox/lib/layout/history";
import { APP_SIDEBAR_WIDTH } from "../lib/constants";
import { useAppSidebar } from "../hooks/app";
import { usePinnedSection } from "../hooks/pinned";
import { useInboxPrefetch } from "../hooks/inbox";
import { FeedFavicon } from "./feed-favicon";

const SettingsDialog = lazyNamed(
  () => import("@modules/settings/components/dialog"),
  "SettingsDialog",
);
const FollowSourcesDialog = lazyNamed(
  () => import("@modules/feeds/components/follow/dialog"),
  "FollowSourcesDialog",
);

const CIRCULAR_SIDEBAR_ACTION_BUTTON_CLASS = cn(
  "size-11 justify-center rounded-full! p-0",
  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-border))]",
  "active:scale-[0.96] active:bg-sidebar-accent active:text-sidebar-accent-foreground active:shadow-[0_0_0_1px_hsl(var(--sidebar-border))]",
  "motion-reduce:active:scale-100",
  "group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0!",
);

type AppSidebarDialogState = {
  followSourcesDialogLoaded: boolean;
  followSourcesOpen: boolean;
  settingsDialogLoaded: boolean;
};

type AppSidebarDialogAction =
  | { type: "load-follow-sources" }
  | { type: "load-settings-dialog" }
  | { type: "set-follow-sources-open"; open: boolean };

const INITIAL_DIALOG_STATE: AppSidebarDialogState = {
  followSourcesDialogLoaded: false,
  followSourcesOpen: false,
  settingsDialogLoaded: false,
};

function dialogStateReducer(
  state: AppSidebarDialogState,
  action: AppSidebarDialogAction,
): AppSidebarDialogState {
  switch (action.type) {
    case "load-follow-sources":
      return state.followSourcesDialogLoaded
        ? state
        : { ...state, followSourcesDialogLoaded: true };
    case "load-settings-dialog":
      return state.settingsDialogLoaded ? state : { ...state, settingsDialogLoaded: true };
    case "set-follow-sources-open":
      return state.followSourcesOpen === action.open
        ? state
        : { ...state, followSourcesOpen: action.open };
  }
}

export function AppSidebar({ className, style }: { className?: string; style?: CSSProperties }) {
  const { platform, settingsOpen, setSettingsOpen } = useAppSidebar();
  const { followedFeedsData } = usePinnedSection();
  const { isInbox, scopedFeedId } = useScope();
  const { prefetchOnFocus, prefetchOnPointerEnter } = useInboxPrefetch();

  const [dialogState, dispatchDialogState] = useReducer(dialogStateReducer, INITIAL_DIALOG_STATE);

  useEffect(() => {
    if (settingsOpen) {
      dispatchDialogState({ type: "load-settings-dialog" });
      void SettingsDialog.preload();
    }
  }, [settingsOpen]);

  const preloadSourcesDialog = () => {
    dispatchDialogState({ type: "load-follow-sources" });
    void FollowSourcesDialog.preload();
  };

  const setFollowSourcesOpen = (open: boolean) => {
    dispatchDialogState({ type: "set-follow-sources-open", open });
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
      <SidebarHeader className="items-center ps-0 pe-2 pt-8 pb-4.5">
        <SidebarMenu className="gap-4.25">
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              tooltip="Kyomi"
              className="size-11 justify-center rounded-full! p-0 hover:bg-transparent focus-visible:ring-0 focus-visible:ring-transparent active:bg-transparent group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0!"
              render={<Link to="/inbox" search={{ filter: "my-feed" as const }} />}
            >
              <KyomiLogo size={28} className="size-auto" />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              tooltip="Add feed"
              variant="secondary"
              className={CIRCULAR_SIDEBAR_ACTION_BUTTON_CLASS}
              onClick={() => {
                preloadSourcesDialog();
                dispatchDialogState({ type: "set-follow-sources-open", open: true });
              }}
              onFocus={preloadSourcesDialog}
              onPointerEnter={preloadSourcesDialog}
            >
              <AddFill size={20} />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <div className="min-h-0 flex-1 ps-0 pe-2" data-sidebar="content" data-slot="sidebar-content">
        <ScrollArea
          className="relative h-full min-h-0 overflow-visible **:data-[slot=scroll-area-scrollbar]:hidden"
          scrollFade
          scrollFadeClassName="data-has-overflow-y:scroll-mask-y-edge-14"
        >
          <SidebarMenu className="items-center gap-3 px-1">
            {feeds.map((feed) => {
              const isActive = isInbox && scopedFeedId === feed.feedId;
              return (
                <SidebarMenuItem key={feed.feedId} className="flex justify-center">
                  <SidebarMenuButton
                    tooltip={feed.title || feed.url}
                    variant="secondary"
                    className="size-11 justify-center overflow-visible! rounded-full! p-0 group-data-[collapsible=icon]:size-11! group-data-[collapsible=icon]:p-0!"
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
                        state={(prev) => ({
                          ...prev,
                          [INBOX_PREVIOUS_FEED_ID_STATE_KEY]:
                            scopedFeedId && scopedFeedId !== feed.feedId ? scopedFeedId : undefined,
                        })}
                      />
                    }
                  >
                    <FeedFavicon
                      className="size-11 shrink-0"
                      faviconUrl={feed.faviconUrl}
                      feedUrl={feed.url}
                      priority="high"
                      shape="squircle"
                      siteUrl={feed.link}
                      squircleCornerRadius={10}
                      title={feed.title || feed.url}
                    />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </ScrollArea>
      </div>

      <SidebarFooter className="items-center ps-0 pe-2 py-4.5">
        <SidebarMenu className="items-center gap-3">
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              tooltip="Upgrade Plan"
              variant="secondary"
              className={CIRCULAR_SIDEBAR_ACTION_BUTTON_CLASS}
              disabled
            >
              <PremiumIcon size={24} />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="flex justify-center">
            <SidebarMenuButton
              tooltip="Settings"
              variant="secondary"
              className={CIRCULAR_SIDEBAR_ACTION_BUTTON_CLASS}
              onClick={() => {
                dispatchDialogState({ type: "load-settings-dialog" });
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
        {dialogState.settingsDialogLoaded ? (
          <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        ) : null}
        {dialogState.followSourcesDialogLoaded ? (
          <FollowSourcesDialog
            enableGlobalShortcut={false}
            hideTrigger
            open={dialogState.followSourcesOpen}
            onOpenChange={setFollowSourcesOpen}
            platform={platform}
          />
        ) : null}
      </Suspense>
    </Sidebar>
  );
}
