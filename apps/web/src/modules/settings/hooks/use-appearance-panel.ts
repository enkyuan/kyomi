"use client";

import { useInboxPreferences } from "@modules/inbox/hooks/use-inbox-preferences";
import { useReaderPreferences } from "@modules/reader/hooks/use-reader-preferences";

export function useAppearancePanel() {
  const {
    limits: inboxLimits,
    preferences: inboxPreferences,
    resetPreferences: resetInboxPreferences,
    setPreferences: setInboxPreferences,
  } = useInboxPreferences();
  const {
    limits: readerLimits,
    preferences: readerPreferences,
    resetPreferences: resetReaderPreferences,
    setPreferences: setReaderPreferences,
  } = useReaderPreferences();

  const ready = Boolean(inboxPreferences && readerPreferences);

  const resetAll = () => {
    resetInboxPreferences();
    resetReaderPreferences();
  };

  return {
    inboxLimits,
    inboxPreferences,
    readerLimits,
    readerPreferences,
    ready,
    resetAll,
    setInboxPreferences,
    setReaderPreferences,
  };
}
