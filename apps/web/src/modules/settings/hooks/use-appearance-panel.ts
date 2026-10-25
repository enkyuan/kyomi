"use client";

import { useInboxPreferences } from "@modules/inbox/hooks/use-preferences";
import { useReaderPreferences } from "@modules/reader/hooks/use-preferences";

export function useAppearancePanel() {
  const {
    limits: inboxLimits,
    preferences: inboxPreferences,
    resetPreferences: resetInboxPreferences,
    setPreferences: setInboxPreferences,
  } = useInboxPreferences();

  const { preferences: readerPreferences, setPreferences: setReaderPreferences } =
    useReaderPreferences();

  const ready = Boolean(inboxPreferences);

  const resetAll = () => {
    resetInboxPreferences();
  };

  return {
    inboxLimits,
    inboxPreferences,
    readerPreferences,
    ready,
    resetAll,
    setInboxPreferences,
    setReaderPreferences,
  };
}
