"use client";

import { createContext, createElement, use, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@integrations/better-auth/auth-provider";
import { inboxPreferencesSchema, type InboxPreferencesDto } from "@lib/api-schemas";
import { getInboxPreferences, updateInboxPreferences } from "../services/preferences";
import { writeInboxArticleOpenBehaviorCookie } from "../lib/layout-persistence";
import { useUserPreferences } from "@modules/preferences";

export type InboxPreferences = InboxPreferencesDto;

const INBOX_PREFERENCES_STORAGE_KEY = "vols.rss:inbox-preferences:v2";
const MIN_INBOX_FONT_SIZE_PX = 14;
const MAX_INBOX_FONT_SIZE_PX = 20;

const DEFAULT_INBOX_PREFERENCES: InboxPreferences = {
  inboxDefaultView: "today",
  inboxDensity: "comfortable",
  articleOpenBehavior: "split",
  inboxMarkReadBehavior: "on-open",
  inboxTimestampDisplay: "absolute",
  inboxTimestampHourCycle: "12h",
  inboxFontSizePx: 16,
  inboxShowRecents: false,
  inboxShowFavicons: true,
};

const InboxPreferencesBootstrapContext = createContext<InboxPreferences | undefined>(undefined);

function inboxPreferencesQueryKey(userId?: string) {
  return ["me", "preferences", "inbox", userId ?? "anonymous"] as const;
}

function inboxPreferencesStorageKey(userId?: string) {
  return userId ? `${INBOX_PREFERENCES_STORAGE_KEY}:${userId}` : INBOX_PREFERENCES_STORAGE_KEY;
}

function sanitizeInboxPreferences(value: unknown): InboxPreferences {
  const withDefaults =
    value && typeof value === "object"
      ? { ...DEFAULT_INBOX_PREFERENCES, ...(value as Partial<InboxPreferences>) }
      : DEFAULT_INBOX_PREFERENCES;
  const parsed = inboxPreferencesSchema.safeParse(withDefaults);
  if (!parsed.success) {
    return DEFAULT_INBOX_PREFERENCES;
  }
  return {
    ...parsed.data,
    inboxFontSizePx: clampInboxFontSize(parsed.data.inboxFontSizePx),
  };
}

function clampInboxFontSize(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return DEFAULT_INBOX_PREFERENCES.inboxFontSizePx;
  }
  return Math.max(MIN_INBOX_FONT_SIZE_PX, Math.min(MAX_INBOX_FONT_SIZE_PX, Math.round(value)));
}

function normalizeInboxPreferencePatch(
  current: InboxPreferences,
  next: Partial<InboxPreferences>,
): InboxPreferences {
  return sanitizeInboxPreferences({
    ...current,
    ...next,
    ...(next.inboxFontSizePx !== undefined
      ? { inboxFontSizePx: clampInboxFontSize(next.inboxFontSizePx) }
      : null),
  });
}

function readCachedInboxPreferences(userId?: string): InboxPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_INBOX_PREFERENCES;
  }

  try {
    const raw =
      window.localStorage.getItem(inboxPreferencesStorageKey(userId)) ??
      window.localStorage.getItem(INBOX_PREFERENCES_STORAGE_KEY);
    return raw ? sanitizeInboxPreferences(JSON.parse(raw)) : DEFAULT_INBOX_PREFERENCES;
  } catch {
    return DEFAULT_INBOX_PREFERENCES;
  }
}

function writeCachedInboxPreferences(next: InboxPreferences, userId?: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(inboxPreferencesStorageKey(userId), JSON.stringify(next));
  } catch {
    // Ignore storage errors (quota exceeded, storage disabled, etc.)
  }
}

function writeInboxPreferencesCache(next: InboxPreferences, userId?: string) {
  writeCachedInboxPreferences(next, userId);
  writeInboxArticleOpenBehaviorCookie(next.articleOpenBehavior);
}

export function InboxPreferencesBootstrapProvider({
  children,
  initialPreferences,
}: {
  children: ReactNode;
  initialPreferences?: InboxPreferences;
}) {
  const value = useMemo(
    () => (initialPreferences ? sanitizeInboxPreferences(initialPreferences) : undefined),
    [initialPreferences],
  );

  return createElement(InboxPreferencesBootstrapContext.Provider, { value }, children);
}

export function resolveInitialInboxPreferences(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: ReturnType<typeof inboxPreferencesQueryKey>,
  initialPreferences?: InboxPreferences,
  userId?: string,
) {
  if (initialPreferences) {
    return sanitizeInboxPreferences(initialPreferences);
  }

  const cachedQuery = queryClient.getQueryData<InboxPreferences>(queryKey);
  if (cachedQuery) {
    return cachedQuery;
  }

  if (typeof window !== "undefined") {
    return readCachedInboxPreferences(userId);
  }

  return DEFAULT_INBOX_PREFERENCES;
}

export function useInboxPreferences(initialPreferences?: InboxPreferences) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const bootstrapPreferences = use(InboxPreferencesBootstrapContext);
  const queryKey = inboxPreferencesQueryKey(user?.id);
  const preferredInitialPreferences = initialPreferences ?? bootstrapPreferences;

  const preferencesStore = useUserPreferences({
    defaults: DEFAULT_INBOX_PREFERENCES,
    initialData: () =>
      resolveInitialInboxPreferences(queryClient, queryKey, preferredInitialPreferences, user?.id),
    normalize: normalizeInboxPreferencePatch,
    onCacheWrite: writeInboxPreferencesCache,
    queryFn: () => getInboxPreferences(),
    queryKey,
    sanitize: sanitizeInboxPreferences,
    updateFn: updateInboxPreferences,
  });

  const limits = useMemo(
    () => ({
      minFontSizePx: MIN_INBOX_FONT_SIZE_PX,
      maxFontSizePx: MAX_INBOX_FONT_SIZE_PX,
    }),
    [],
  );

  return {
    ...preferencesStore,
    defaults: DEFAULT_INBOX_PREFERENCES,
    limits,
  };
}
