"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarFooterActions } from "@components/navigation/sidebar-footer-actions";
import { SidebarInboxNav } from "@components/navigation/sidebar-inbox-nav";
import { SidebarPinnedSection } from "@components/navigation/sidebar-pinned-section";
import { SidebarWorkspaceHeader } from "@components/navigation/sidebar-workspace-header";
import { SettingsDialog } from "src/components/pages/settings";
import { Sidebar, SidebarContent } from "@components/ui/sidebar";
import { getSidebarInboxCounts } from "@lib/inbox-functions";

export function AppSidebar() {
  const [isMacPlatform, setIsMacPlatform] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timezoneOffsetMinutes, setTimezoneOffsetMinutes] = useState<number | undefined>(undefined);
  const inboxSummaryQuery = useQuery({
    queryKey: ["sidebar", "inbox-summary", timezoneOffsetMinutes],
    enabled: timezoneOffsetMinutes !== undefined,
    queryFn: () => getSidebarInboxCounts({ data: { timezoneOffsetMinutes } }),
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

      <SidebarContent className="overflow-x-hidden">
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
