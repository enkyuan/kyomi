"use client";

import type { CSSProperties } from "react";
import { Suspense, useEffect, useState } from "react";
import { cn } from "@lib/utils";
import { SidebarReaderFocusProvider } from "@vols.rss/ui/sidebar-reader-focus";
import { Sidebar, SidebarContent } from "@vols.rss/ui/sidebar";
import { APP_SIDEBAR_WIDTH } from "../lib/constants";
import { useAppSidebar } from "../hooks/use-app-sidebar";
import { FooterActions } from "./footer-actions";
import { Header } from "./header";
import { InboxNav } from "./inbox-nav";
import { PinnedSection } from "./pinned-section";
import { lazyNamed } from "@lib/lazy-named";

const SettingsDialog = lazyNamed(
  () => import("@modules/settings/components/dialog"),
  "SettingsDialog",
);

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
  const [settingsDialogLoaded, setSettingsDialogLoaded] = useState(false);

  useEffect(() => {
    if (settingsOpen) {
      setSettingsDialogLoaded(true);
      void SettingsDialog.preload();
    }
  }, [settingsOpen]);

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
            setSettingsDialogLoaded(true);
            void SettingsDialog.preload();
            setSettingsOpen(true);
          }}
        />
        <Suspense fallback={null}>
          {settingsDialogLoaded ? (
            <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
          ) : null}
        </Suspense>
      </Sidebar>
    </SidebarReaderFocusProvider>
  );
}
