"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@integrations/better-auth/auth-provider";
import { inboxPreferencesSchema, type InboxPreferencesDto } from "@lib/api-schemas";
import { getInboxPreferences, updateInboxPreferences } from "@lib/inbox-preferences-functions";

export type InboxPreferences = InboxPreferencesDto;

const INBOX_PREFERENCES_STORAGE_KEY = "cronos:inbox-preferences:v2";
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

  window.localStorage.setItem(inboxPreferencesStorageKey(userId), JSON.stringify(next));
}

export function useInboxPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = inboxPreferencesQueryKey(user?.id);
  const latestRequestIdRef = useRef(0);

  const preferencesQuery = useQuery({
    queryKey,
    queryFn: () => getInboxPreferences(),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
    initialData: () => readCachedInboxPreferences(user?.id),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (preferencesQuery.data) {
      writeCachedInboxPreferences(preferencesQuery.data, user?.id);
    }
  }, [preferencesQuery.data, user?.id]);

  const updateMutation = useMutation({
    mutationFn: ({
      patch,
      requestId: _requestId,
      rollback: _rollback,
    }: {
      patch: Partial<InboxPreferences>;
      requestId: number;
      rollback: InboxPreferences;
    }) => updateInboxPreferences({ data: patch }),
    onError: (_error, variables) => {
      if (variables.requestId !== latestRequestIdRef.current) {
        return;
      }
      queryClient.setQueryData(queryKey, variables.rollback);
      writeCachedInboxPreferences(variables.rollback, user?.id);
    },
    onSuccess: (serverPreferences, variables) => {
      if (variables.requestId !== latestRequestIdRef.current) {
        return;
      }
      const sanitized = sanitizeInboxPreferences(serverPreferences);
      queryClient.setQueryData(queryKey, sanitized);
      writeCachedInboxPreferences(sanitized, user?.id);
    },
  });

  return {
    preferences: preferencesQuery.data,
    defaults: DEFAULT_INBOX_PREFERENCES,
    setPreferences: (next: Partial<InboxPreferences>) => {
      const current =
        queryClient.getQueryData<InboxPreferences>(queryKey) ??
        preferencesQuery.data ??
        DEFAULT_INBOX_PREFERENCES;
      const optimistic = normalizeInboxPreferencePatch(current, next);
      if (JSON.stringify(current) === JSON.stringify(optimistic)) {
        return;
      }

      queryClient.setQueryData(queryKey, optimistic);
      writeCachedInboxPreferences(optimistic, user?.id);

      void queryClient.cancelQueries({ queryKey });

      if (!user?.id) {
        return;
      }

      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      updateMutation.mutate({
        patch: next,
        requestId,
        rollback: current,
      });
    },
    resetPreferences: () => {
      const current =
        queryClient.getQueryData<InboxPreferences>(queryKey) ??
        preferencesQuery.data ??
        DEFAULT_INBOX_PREFERENCES;

      queryClient.setQueryData(queryKey, DEFAULT_INBOX_PREFERENCES);
      writeCachedInboxPreferences(DEFAULT_INBOX_PREFERENCES, user?.id);

      void queryClient.cancelQueries({ queryKey });

      if (!user?.id) {
        return;
      }

      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;
      updateMutation.mutate({
        patch: DEFAULT_INBOX_PREFERENCES,
        requestId,
        rollback: current,
      });
    },
    isLoadingPreferences: preferencesQuery.isLoading,
    isUpdatingPreferences: updateMutation.isPending,
    limits: {
      minFontSizePx: MIN_INBOX_FONT_SIZE_PX,
      maxFontSizePx: MAX_INBOX_FONT_SIZE_PX,
    },
  };
}
