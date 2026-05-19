"use client";

import { useState } from "react";
import { usePlatform } from "@hooks/use-platform";
import { useSidebarInboxCounts } from "./use-sidebar-inbox";

export function useAppSidebar() {
  const platform = usePlatform();
  const { counts } = useSidebarInboxCounts();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return {
    counts,
    platform,
    settingsOpen,
    setSettingsOpen,
  };
}
