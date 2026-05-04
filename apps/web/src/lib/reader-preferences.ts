"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@integrations/better-auth/auth-provider";
import type {
  ReaderContentWidthDto,
  ReaderDefaultModeDto,
  ReaderPreferencesDto,
} from "@lib/api-schemas";
import { getReaderPreferences, updateReaderPreferences } from "@lib/reader-preferences-functions";

export type ReaderDefaultMode = ReaderDefaultModeDto;
export type ReaderContentWidth = ReaderContentWidthDto;
export type ReaderPreferences = ReaderPreferencesDto;

const READER_PREFERENCES_STORAGE_KEY = "cronos:reader-preferences:v1";
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

  window.localStorage.setItem(readerPreferencesStorageKey(userId), JSON.stringify(next));
}

export function useReaderPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = readerPreferencesQueryKey(user?.id);

  const preferencesQuery = useQuery({
    queryKey,
    queryFn: () => getReaderPreferences(),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
    initialData: () => readCachedReaderPreferences(user?.id),
    // Avoid GET /me/preferences completing during slider interaction and overwriting optimistic updates.
    refetchOnWindowFocus: false,
  });

  const latestRequestIdRef = useRef(0);
  const mutationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutationRollbackRef = useRef<ReaderPreferences | null>(null);

  useEffect(() => {
    return () => {
      if (mutationDebounceRef.current) {
        clearTimeout(mutationDebounceRef.current);
        mutationDebounceRef.current = null;
        mutationRollbackRef.current = null;
      }
    };
  }, []);

  const preferences = preferencesQuery.data;

  const updateMutation = useMutation({
    mutationFn: ({
      patch,
    }: {
      patch: Partial<ReaderPreferences>;
      requestId: number;
      rollback: ReaderPreferences;
    }) => updateReaderPreferences({ data: patch }),
    onError: (_error, variables) => {
      if (variables.requestId !== latestRequestIdRef.current) {
        return;
      }
      queryClient.setQueryData(queryKey, variables.rollback);
      writeCachedReaderPreferences(variables.rollback, user?.id);
    },
    onSuccess: (serverPreferences, variables) => {
      if (variables.requestId !== latestRequestIdRef.current) {
        return;
      }
      const sanitized = sanitizeReaderPreferences(serverPreferences);
      queryClient.setQueryData(queryKey, sanitized);
      writeCachedReaderPreferences(sanitized, user?.id);
    },
  });

  const limits = useMemo(
    () => ({ minFontSizePx: MIN_FONT_SIZE_PX, maxFontSizePx: MAX_FONT_SIZE_PX }),
    [],
  );

  return {
    preferences,
    setPreferences: (next: Partial<ReaderPreferences>) => {
      const current =
        queryClient.getQueryData<ReaderPreferences>(queryKey) ??
        preferencesQuery.data ??
        DEFAULT_READER_PREFERENCES;
      const optimistic = sanitizeReaderPreferences({ ...current, ...next });
      if (JSON.stringify(current) === JSON.stringify(optimistic)) {
        return;
      }

      // Apply optimistic cache + storage synchronously so UI never flashes stale values while
      // `cancelQueries` is pending (await previously deferred this update).
      queryClient.setQueryData(queryKey, optimistic);
      writeCachedReaderPreferences(optimistic, user?.id);

      void queryClient.cancelQueries({ queryKey });

      if (!user?.id) {
        return;
      }

      const currentRequestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = currentRequestId;

      if (!mutationDebounceRef.current) {
        mutationRollbackRef.current = current;
      }
      if (mutationDebounceRef.current) clearTimeout(mutationDebounceRef.current);

      mutationDebounceRef.current = setTimeout(() => {
        mutationDebounceRef.current = null;
        const rollback = mutationRollbackRef.current ?? current;
        mutationRollbackRef.current = null;
        const patch = queryClient.getQueryData<ReaderPreferences>(queryKey) ?? optimistic;
        updateMutation.mutate({ patch, requestId: currentRequestId, rollback });
      }, 300);
    },
    setPreferencesAsync: async (next: Partial<ReaderPreferences>) => {
      const current =
        queryClient.getQueryData<ReaderPreferences>(queryKey) ??
        preferencesQuery.data ??
        DEFAULT_READER_PREFERENCES;
      const optimistic = sanitizeReaderPreferences({ ...current, ...next });
      if (JSON.stringify(current) === JSON.stringify(optimistic)) {
        return optimistic;
      }

      queryClient.setQueryData(queryKey, optimistic);
      writeCachedReaderPreferences(optimistic, user?.id);

      void queryClient.cancelQueries({ queryKey });

      if (!user?.id) {
        return optimistic;
      }

      const currentRequestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = currentRequestId;

      return updateMutation.mutateAsync({
        patch: optimistic,
        requestId: currentRequestId,
        rollback: current,
      });
    },
    resetPreferences: () => {
      const current =
        queryClient.getQueryData<ReaderPreferences>(queryKey) ??
        preferencesQuery.data ??
        DEFAULT_READER_PREFERENCES;
      queryClient.setQueryData(queryKey, DEFAULT_READER_PREFERENCES);
      writeCachedReaderPreferences(DEFAULT_READER_PREFERENCES, user?.id);

      void queryClient.cancelQueries({ queryKey });

      if (!user?.id) {
        return;
      }

      const currentRequestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = currentRequestId;

      updateMutation.mutate({
        patch: DEFAULT_READER_PREFERENCES,
        requestId: currentRequestId,
        rollback: current,
      });
    },
    defaults: DEFAULT_READER_PREFERENCES,
    limits,
    isLoadingPreferences: preferencesQuery.isLoading,
    isUpdatingPreferences: updateMutation.isPending,
  };
}
