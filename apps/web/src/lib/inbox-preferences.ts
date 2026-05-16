"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@integrations/better-auth/auth-provider";
import { inboxPreferencesSchema, type InboxPreferencesDto } from "@lib/api-schemas";
import { getInboxPreferences, updateInboxPreferences } from "@lib/inbox-preferences-functions";
import { writeInboxArticleOpenBehaviorCookie } from "@modules/inbox/lib/layout-persistence";

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
  const bootstrapPreferences = useContext(InboxPreferencesBootstrapContext);
  const queryKey = inboxPreferencesQueryKey(user?.id);
  const latestRequestIdRef = useRef(0);
  const mutationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutationRollbackRef = useRef<InboxPreferences | null>(null);
  const preferredInitialPreferences = initialPreferences ?? bootstrapPreferences;

  const preferencesQuery = useQuery({
    queryKey,
    queryFn: () => getInboxPreferences(),
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
    // Loader-provided preferences are the authoritative server state for this route. Prefer them
    // over local cache so a stale client value cannot hide the inbox list by forcing reader focus.
    initialData: () =>
      resolveInitialInboxPreferences(queryClient, queryKey, preferredInitialPreferences, user?.id),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (preferencesQuery.data) {
      writeCachedInboxPreferences(preferencesQuery.data, user?.id);
      writeInboxArticleOpenBehaviorCookie(preferencesQuery.data.articleOpenBehavior);
    }
  }, [preferencesQuery.data, user?.id]);

  useEffect(() => {
    return () => {
      if (mutationDebounceRef.current) {
        clearTimeout(mutationDebounceRef.current);
        mutationDebounceRef.current = null;
        mutationRollbackRef.current = null;
      }
    };
  }, []);

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

  const limits = useMemo(
    () => ({
      minFontSizePx: MIN_INBOX_FONT_SIZE_PX,
      maxFontSizePx: MAX_INBOX_FONT_SIZE_PX,
    }),
    [],
  );

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
      writeInboxArticleOpenBehaviorCookie(optimistic.articleOpenBehavior);

      void queryClient.cancelQueries({ queryKey });

      if (!user?.id) {
        return;
      }

      const requestId = latestRequestIdRef.current + 1;
      latestRequestIdRef.current = requestId;

      if (!mutationDebounceRef.current) {
        mutationRollbackRef.current = current;
      }
      if (mutationDebounceRef.current) {
        clearTimeout(mutationDebounceRef.current);
      }

      mutationDebounceRef.current = setTimeout(() => {
        mutationDebounceRef.current = null;
        const rollback = mutationRollbackRef.current ?? current;
        mutationRollbackRef.current = null;
        const patch = queryClient.getQueryData<InboxPreferences>(queryKey) ?? optimistic;
        updateMutation.mutate({
          patch,
          requestId,
          rollback,
        });
      }, 300);
    },
    resetPreferences: () => {
      const current =
        queryClient.getQueryData<InboxPreferences>(queryKey) ??
        preferencesQuery.data ??
        DEFAULT_INBOX_PREFERENCES;

      queryClient.setQueryData(queryKey, DEFAULT_INBOX_PREFERENCES);
      writeCachedInboxPreferences(DEFAULT_INBOX_PREFERENCES, user?.id);
      writeInboxArticleOpenBehaviorCookie(DEFAULT_INBOX_PREFERENCES.articleOpenBehavior);

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
    limits,
  };
}
