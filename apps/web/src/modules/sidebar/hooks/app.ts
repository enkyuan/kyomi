"use client";

import { usePlatform } from "@hooks/use-platform";

export function useAppSidebar() {
  const platform = usePlatform();

  return {
    platform,
  };
}
