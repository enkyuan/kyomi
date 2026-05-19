"use client";

import { useInboxPreferences } from "@modules/inbox";
import { useReaderPreferences } from "@modules/reader";

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
