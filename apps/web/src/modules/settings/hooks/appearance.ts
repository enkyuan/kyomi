"use client";

import { useInboxPreferences } from "@modules/inbox/hooks/data";

export function useAppearancePanel() {
  const {
    limits: inboxLimits,
    preferences: inboxPreferences,
    resetPreferences: resetInboxPreferences,
    setPreferences: setInboxPreferences,
  } = useInboxPreferences();

  const ready = Boolean(inboxPreferences);

  const resetAll = () => {
    resetInboxPreferences();
  };

  return {
    inboxLimits,
    inboxPreferences,
    ready,
    resetAll,
    setInboxPreferences,
  };
}
