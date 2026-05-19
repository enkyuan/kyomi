"use client";

import { useMemo } from "react";
import { useAuth } from "@integrations/better-auth/auth-provider";
import type {
  ReaderContentWidthDto,
  ReaderDefaultModeDto,
  ReaderPreferencesDto,
} from "@lib/api-schemas";
import { getReaderPreferences, updateReaderPreferences } from "../services/reader-preferences";
import { useUserPreferences } from "@modules/preferences";

export type ReaderDefaultMode = ReaderDefaultModeDto;
export type ReaderContentWidth = ReaderContentWidthDto;
export type ReaderPreferences = ReaderPreferencesDto;

const READER_PREFERENCES_STORAGE_KEY = "vols.rss:reader-preferences:v1";
const MIN_FONT_SIZE_PX = 14;
const MAX_FONT_SIZE_PX = 22;

const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  defaultMode: "smart",
  fontSizePx: 17,
  contentWidth: "wide",
  openLinksInNewTab: true,
  showLinkPreviews: true,
  showImages: true,
};

function readerPreferencesQueryKey(userId?: string) {
  return ["me", "preferences", "reader", userId ?? "anonymous"] as const;
}

function readerPreferencesStorageKey(userId?: string) {
  return userId ? `${READER_PREFERENCES_STORAGE_KEY}:${userId}` : READER_PREFERENCES_STORAGE_KEY;
}

function clampFontSize(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_READER_PREFERENCES.fontSizePx;
  }
  return Math.max(MIN_FONT_SIZE_PX, Math.min(MAX_FONT_SIZE_PX, Math.round(value)));
}

function parseDefaultMode(value: unknown): ReaderDefaultMode {
  if (value === "original" || value === "extracted" || value === "smart") {
    return value;
  }
  return DEFAULT_READER_PREFERENCES.defaultMode;
}

function parseContentWidth(value: unknown): ReaderContentWidth {
  if (value === "narrow" || value === "wide") {
    return value;
  }
  if (value === "medium") {
    return "wide";
  }
  return DEFAULT_READER_PREFERENCES.contentWidth;
}

function sanitizeReaderPreferences(value: unknown): ReaderPreferences {
  if (!value || typeof value !== "object") {
    return DEFAULT_READER_PREFERENCES;
  }
  const record = value as Partial<ReaderPreferences>;
  return {
    defaultMode: parseDefaultMode(record.defaultMode),
    fontSizePx: clampFontSize(record.fontSizePx),
    contentWidth: parseContentWidth(record.contentWidth),
    openLinksInNewTab:
      typeof record.openLinksInNewTab === "boolean"
        ? record.openLinksInNewTab
        : DEFAULT_READER_PREFERENCES.openLinksInNewTab,
    showLinkPreviews:
      typeof record.showLinkPreviews === "boolean"
        ? record.showLinkPreviews
        : DEFAULT_READER_PREFERENCES.showLinkPreviews,
    showImages:
      typeof record.showImages === "boolean"
        ? record.showImages
        : DEFAULT_READER_PREFERENCES.showImages,
  };
}

function normalizeReaderPreferencePatch(
  current: ReaderPreferences,
  next: Partial<ReaderPreferences>,
): ReaderPreferences {
  return sanitizeReaderPreferences({ ...current, ...next });
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
    window.localStorage.setItem(readerPreferencesStorageKey(userId), JSON.stringify(next));
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

  const limits = useMemo(
    () => ({ minFontSizePx: MIN_FONT_SIZE_PX, maxFontSizePx: MAX_FONT_SIZE_PX }),
    [],
  );

  return {
    ...preferencesStore,
    defaults: DEFAULT_READER_PREFERENCES,
    limits,
  };
}
