"use client";

import { createContext, createElement, use, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@integrations/better-auth/provider";
import { INBOX_PREFERENCES_STORAGE_KEY } from "@lib/shell/keys";
import type { InboxPreferencesDto } from "@kyomi/reader/schemas";
import { usePreferences } from "@modules/preferences/hooks/use-preferences";
import { writeInboxArticleOpenBehaviorCookie } from "../lib/layout/persistence";
import {
  DEFAULT_INBOX_PREFERENCES,
  getInboxPreferenceLimits,
  getInboxPreferences,
  normalizeInboxPreferencePatch,
  sanitizeInboxPreferences,
  updateInboxPreferences,
} from "../lib/preferences";

export type InboxPreferences = InboxPreferencesDto;

const InboxPreferencesBootstrapContext = createContext<InboxPreferences | undefined>(undefined);
const INBOX_TIMESTAMP_DISPLAY_USER_SET_STORAGE_KEY = `${INBOX_PREFERENCES_STORAGE_KEY}:timestamp-display-user-set`;

function inboxPreferencesQueryKey(userId?: string) {
  return ["me", "preferences", "inbox", userId ?? "anonymous"] as const;
}

function inboxPreferencesStorageKey(userId?: string) {
  return userId ? `${INBOX_PREFERENCES_STORAGE_KEY}:${userId}` : INBOX_PREFERENCES_STORAGE_KEY;
}

function inboxTimestampDisplayUserSetStorageKey(userId?: string) {
  return userId
    ? `${INBOX_TIMESTAMP_DISPLAY_USER_SET_STORAGE_KEY}:${userId}`
    : INBOX_TIMESTAMP_DISPLAY_USER_SET_STORAGE_KEY;
}

function hasStoredTimestampDisplayChoice(userId?: string) {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.localStorage.getItem(inboxTimestampDisplayUserSetStorageKey(userId)) === "1" ||
    window.localStorage.getItem(INBOX_TIMESTAMP_DISPLAY_USER_SET_STORAGE_KEY) === "1"
  );
}

function markStoredTimestampDisplayChoice(userId?: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(INBOX_TIMESTAMP_DISPLAY_USER_SET_STORAGE_KEY, "1");
    window.localStorage.setItem(inboxTimestampDisplayUserSetStorageKey(userId), "1");
  } catch {
    // Ignore storage errors (quota exceeded, storage disabled, etc.)
  }
}

function clearStoredTimestampDisplayChoice(userId?: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(INBOX_TIMESTAMP_DISPLAY_USER_SET_STORAGE_KEY);
    window.localStorage.removeItem(inboxTimestampDisplayUserSetStorageKey(userId));
  } catch {
    // Ignore storage errors (quota exceeded, storage disabled, etc.)
  }
}

function normalizeTimestampDisplayDefault(
  preferences: InboxPreferences,
  userId?: string,
): InboxPreferences {
  if (preferences.inboxTimestampDisplay !== "absolute" || hasStoredTimestampDisplayChoice(userId)) {
    return preferences;
  }

  return {
    ...preferences,
    inboxTimestampDisplay: DEFAULT_INBOX_PREFERENCES.inboxTimestampDisplay,
  };
}

function hasTimestampDisplayPatch(next: Partial<InboxPreferences>) {
  return Object.prototype.hasOwnProperty.call(next, "inboxTimestampDisplay");
}

function readCachedInboxPreferences(userId?: string): InboxPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_INBOX_PREFERENCES;
  }

  try {
    const raw =
      window.localStorage.getItem(inboxPreferencesStorageKey(userId)) ??
      window.localStorage.getItem(INBOX_PREFERENCES_STORAGE_KEY);
    return raw
      ? normalizeTimestampDisplayDefault(sanitizeInboxPreferences(JSON.parse(raw)), userId)
      : DEFAULT_INBOX_PREFERENCES;
  } catch {
    return DEFAULT_INBOX_PREFERENCES;
  }
}

function writeCachedInboxPreferences(next: InboxPreferences, userId?: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const serialized = JSON.stringify(next);
    window.localStorage.setItem(INBOX_PREFERENCES_STORAGE_KEY, serialized);
    window.localStorage.setItem(inboxPreferencesStorageKey(userId), serialized);
  } catch {
    // Ignore storage errors (quota exceeded, storage disabled, etc.)
  }
}

function writeInboxPreferencesCache(next: InboxPreferences, userId?: string) {
  writeCachedInboxPreferences(next, userId);
  writeInboxArticleOpenBehaviorCookie(next.articleOpenBehavior);
}

export function resolveInitialInboxPreferences(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: ReturnType<typeof inboxPreferencesQueryKey>,
  initialPreferences?: InboxPreferences,
  userId?: string,
) {
  if (initialPreferences) {
    return normalizeTimestampDisplayDefault(sanitizeInboxPreferences(initialPreferences), userId);
  }

  const cachedQuery = queryClient.getQueryData<InboxPreferences>(queryKey);
  if (cachedQuery) {
    return normalizeTimestampDisplayDefault(cachedQuery, userId);
  }

  if (typeof window !== "undefined") {
    return readCachedInboxPreferences(userId);
  }

  return DEFAULT_INBOX_PREFERENCES;
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

export function useInboxPreferences(initialPreferences?: InboxPreferences) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const bootstrapPreferences = use(InboxPreferencesBootstrapContext);
  const queryKey = inboxPreferencesQueryKey(user?.id);
  const preferredInitialPreferences = initialPreferences ?? bootstrapPreferences;

  const preferencesStore = usePreferences({
    defaults: DEFAULT_INBOX_PREFERENCES,
    initialData: () =>
      resolveInitialInboxPreferences(queryClient, queryKey, preferredInitialPreferences, user?.id),
    normalize: normalizeInboxPreferencePatch,
    onCacheWrite: writeInboxPreferencesCache,
    queryFn: async () => normalizeTimestampDisplayDefault(await getInboxPreferences(), user?.id),
    queryKey,
    sanitize: sanitizeInboxPreferences,
    updateFn: updateInboxPreferences,
  });

  const limits = useMemo(() => getInboxPreferenceLimits(), []);

  return {
    ...preferencesStore,
    setPreferences: (next: Partial<InboxPreferences>) => {
      if (hasTimestampDisplayPatch(next)) {
        markStoredTimestampDisplayChoice(user?.id);
      }
      preferencesStore.setPreferences(next);
    },
    setPreferencesAsync: async (next: Partial<InboxPreferences>) => {
      if (hasTimestampDisplayPatch(next)) {
        markStoredTimestampDisplayChoice(user?.id);
      }
      return preferencesStore.setPreferencesAsync(next);
    },
    resetPreferences: () => {
      clearStoredTimestampDisplayChoice(user?.id);
      preferencesStore.resetPreferences();
    },
    defaults: DEFAULT_INBOX_PREFERENCES,
    limits,
  };
}
