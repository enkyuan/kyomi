"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { SidebarFooterActions } from "@components/navigation/sidebar-footer-actions";
import { SidebarInboxNav } from "@components/navigation/sidebar-inbox-nav";
import { SidebarPinnedSection } from "@components/navigation/sidebar-pinned-section";
import { SidebarWorkspaceHeader } from "@components/navigation/sidebar-workspace-header";
import { SettingsDialog } from "@modules/settings/dialog";
import { Sidebar, SidebarContent } from "@components/ui/sidebar";
import { getSidebarInboxCounts } from "@modules/inbox/api";
import { isInboxPathname } from "@lib/routes/inbox-path";

export function AppSidebar() {
  const location = useLocation();
  const [isMacPlatform, setIsMacPlatform] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timezoneOffsetMinutes, setTimezoneOffsetMinutes] = useState<number | undefined>(undefined);
  const isInbox = isInboxPathname(location.pathname);
  const scopedFeedId = isInbox ? location.search.feedId : undefined;
  const scopedFolderId = isInbox ? location.search.folderId : undefined;
  const inboxSummaryQuery = useQuery({
    queryKey: ["sidebar", "inbox-summary", timezoneOffsetMinutes, scopedFeedId, scopedFolderId],
    enabled: timezoneOffsetMinutes !== undefined,
    queryFn: () =>
      getSidebarInboxCounts({
        data: { timezoneOffsetMinutes, feedId: scopedFeedId, folderId: scopedFolderId },
      }),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const counts = inboxSummaryQuery.data ?? { today: 0, unread: 0, saved: 0 };

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }

    setIsMacPlatform(/Mac|iPhone|iPad|iPod/.test(navigator.platform));
    setTimezoneOffsetMinutes(new Date().getTimezoneOffset());
  }, []);

  return (
    <Sidebar
      side="left"
      variant="inset"
      collapsible="icon"
      className="p-0 px-0 py-2 group-data-[collapsible=icon]:**:data-[sidebar=menu-item]:flex group-data-[collapsible=icon]:**:data-[sidebar=menu-item]:justify-start group-data-[collapsible=icon]:**:data-[sidebar=menu-button]:justify-start group-data-[collapsible=icon]:**:data-[sidebar=menu-button]:px-2"
      style={{ "--sidebar-width": "12rem" } as CSSProperties}
    >
      <SidebarWorkspaceHeader isMacPlatform={isMacPlatform} />

      <SidebarContent>
        <SidebarInboxNav counts={counts} />
        <SidebarPinnedSection />
      </SidebarContent>

      <SidebarFooterActions
        onOpenSettings={() => {
          setSettingsOpen(true);
        }}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Sidebar>
  );
}
