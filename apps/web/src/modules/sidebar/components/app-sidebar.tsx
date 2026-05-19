"use client";

import type { CSSProperties } from "react";
import { cn } from "@lib/utils";
import { SidebarReaderFocusProvider } from "@vols.rss/ui/sidebar-reader-focus";
import { SettingsDialog } from "@modules/settings/components/dialog";
import { Sidebar, SidebarContent } from "@vols.rss/ui/sidebar";
import { APP_SIDEBAR_WIDTH } from "../lib/constants";
import { useAppSidebar } from "../hooks/use-app-sidebar";
import { FooterActions } from "./footer-actions";
import { Header } from "./header";
import { InboxNav } from "./inbox-nav";
import { PinnedSection } from "./pinned-section";

export function AppSidebar({
  className,
  style,
  readerFocusSidebar = false,
}: {
  className?: string;
  style?: CSSProperties;
  readerFocusSidebar?: boolean;
}) {
  const { counts, platform, settingsOpen, setSettingsOpen } = useAppSidebar();

  return (
    <SidebarReaderFocusProvider value={readerFocusSidebar}>
      <Sidebar
        side="left"
        variant="inset"
        collapsible="icon"
        className={cn(
          "p-0 px-0 py-2 group-data-[collapsible=icon]:**:data-[sidebar=menu-item]:flex group-data-[collapsible=icon]:**:data-[sidebar=menu-item]:justify-start group-data-[collapsible=icon]:**:data-[sidebar=menu-button]:justify-start group-data-[collapsible=icon]:**:data-[sidebar=menu-button]:px-2",
          className,
        )}
        style={{ "--sidebar-width": APP_SIDEBAR_WIDTH, ...style } as CSSProperties}
      >
        <Header platform={platform} isReaderFocusSidebar={readerFocusSidebar} />

        <SidebarContent>
          <InboxNav counts={counts} />
          <PinnedSection />
        </SidebarContent>

        <FooterActions
          onOpenSettings={() => {
            setSettingsOpen(true);
          }}
        />
        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      </Sidebar>
    </SidebarReaderFocusProvider>
  );
}
