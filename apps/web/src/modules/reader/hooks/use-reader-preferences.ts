"use client";

import { useMemo } from "react";
import { useAuth } from "@integrations/better-auth/provider";
import { READER_PREFERENCES_STORAGE_KEY } from "@lib/shell/storage-keys";
import { useUserPreferences } from "@modules/preferences";
import { getReaderPreferences, updateReaderPreferences } from "../reader-preferences";
import {
  DEFAULT_READER_PREFERENCES,
  getReaderPreferenceLimits,
  normalizeReaderPreferencePatch,
  sanitizeReaderPreferences,
  type ReaderContentWidth,
  type ReaderDefaultMode,
  type ReaderPreferences,
} from "../lib/preferences";

export type { ReaderContentWidth, ReaderDefaultMode, ReaderPreferences };

function readerPreferencesQueryKey(userId?: string) {
  return ["me", "preferences", "reader", userId ?? "anonymous"] as const;
}

function readerPreferencesStorageKey(userId?: string) {
  return userId ? `${READER_PREFERENCES_STORAGE_KEY}:${userId}` : READER_PREFERENCES_STORAGE_KEY;
}

function readCachedReaderPreferences(userId?: string): ReaderPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_READER_PREFERENCES;
  }

  try {
    const raw =
      window.localStorage.getItem(readerPreferencesStorageKey(userId)) ??
      window.localStorage.getItem(READER_PREFERENCES_STORAGE_KEY);
    return raw ? sanitizeReaderPreferences(JSON.parse(raw)) : DEFAULT_READER_PREFERENCES;
  } catch {
    return DEFAULT_READER_PREFERENCES;
  }
}

function writeCachedReaderPreferences(next: ReaderPreferences, userId?: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const serialized = JSON.stringify(next);
    window.localStorage.setItem(READER_PREFERENCES_STORAGE_KEY, serialized);
    window.localStorage.setItem(readerPreferencesStorageKey(userId), serialized);
  } catch {
    // Ignore storage errors (quota exceeded, storage disabled, etc.)
  }
}

export function useReaderPreferences() {
  const { user } = useAuth();
  const queryKey = readerPreferencesQueryKey(user?.id);
  const preferencesStore = useUserPreferences({
    defaults: DEFAULT_READER_PREFERENCES,
    initialData: () => readCachedReaderPreferences(user?.id),
    normalize: normalizeReaderPreferencePatch,
    onCacheWrite: writeCachedReaderPreferences,
    queryFn: () => getReaderPreferences(),
    queryKey,
    sanitize: sanitizeReaderPreferences,
    updateFn: updateReaderPreferences,
  });

  const limits = useMemo(() => getReaderPreferenceLimits(), []);

  return {
    ...preferencesStore,
    defaults: DEFAULT_READER_PREFERENCES,
    limits,
  };
}
