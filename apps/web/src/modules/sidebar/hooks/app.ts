"use client";

import { useState } from "react";
import { usePlatform } from "@hooks/use-platform";

export function useAppSidebar() {
  const platform = usePlatform();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return {
    platform,
    settingsOpen,
    setSettingsOpen,
  };
}
