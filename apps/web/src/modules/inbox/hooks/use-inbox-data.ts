"use client";

import {
  createContext,
  createElement,
  use,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@integrations/better-auth/provider";
import { usePreferences } from "@hooks/use-preferences";
import { INBOX_PREFERENCES_STORAGE_KEY } from "@lib/shell/keys";
import type { InboxPreferencesDto } from "@lib/schemas/index";
import { writeInboxArticleOpenBehaviorCookie } from "../lib/layout/persistence";
import {
  DEFAULT_INBOX_PREFERENCES,
  getInboxPreferenceLimits,
  normalizeInboxPreferencePatch,
  sanitizeInboxPreferences,
} from "../lib/preferences";
import {
  getInboxItemCacheSnapshot,
  restoreInboxItemCacheSnapshot,
  updateInboxItemCaches,
} from "../queries/cache";
import { inboxDetailQueryOptions, inboxItemsInfiniteQueryOptions } from "../queries/options";
import {
  getInboxItems,
  recordInboxItemView,
  updateInboxItemState,
  type InboxFilter,
  type InboxItem,
  type InboxSort,
} from "../lib/articles/index";
import { getInboxPreferences, updateInboxPreferences } from "@modules/preferences/inbox";

export type InboxPreferences = InboxPreferencesDto;
export type InboxItemPatch = Partial<Pick<InboxItem, "isRead" | "isSaved">> & {
  isHidden?: boolean;
};

type UseInboxQueriesInput = {
  filter: InboxFilter;
  search?: string;
  feedId?: string;
  folderId?: string;
  itemId?: string;
  includeRead?: boolean;
  sort?: InboxSort;
  timezoneOffsetMinutes?: number;
};

type InboxItemStateMutationInput = {
  itemId: string;
  patch: InboxItemPatch;
  removeFromList?: boolean;
};

const InboxPreferencesBootstrapContext = createContext<InboxPreferences | undefined>(undefined);

function inboxPreferencesQueryKey(userId?: string) {
  return ["me", "preferences", "inbox", userId ?? "anonymous"] as const;
}

function inboxPreferencesStorageKey(userId?: string) {
  return userId ? `${INBOX_PREFERENCES_STORAGE_KEY}:${userId}` : INBOX_PREFERENCES_STORAGE_KEY;
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

/**
 * De-duplicates by id across infinite-query pages.
 * The API also collapses same-feed canonical URL duplicates server-side - this is only a client
 * idempotency guard.
 */
export function dedupePagedInboxItemsById(
  pages: Array<{ items: Awaited<ReturnType<typeof getInboxItems>>["items"] }> | undefined,
) {
  if (!pages) return [];
  const unique = new Map<string, Awaited<ReturnType<typeof getInboxItems>>["items"][number]>();
  for (const page of pages) {
    if (!page?.items) {
      continue;
    }
    for (const item of page.items) {
      if (!unique.has(item.id)) {
        unique.set(item.id, item);
      }
    }
  }
  return Array.from(unique.values());
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
    queryFn: () => getInboxPreferences(),
    queryKey,
    sanitize: sanitizeInboxPreferences,
    updateFn: updateInboxPreferences,
  });

  const limits = useMemo(() => getInboxPreferenceLimits(), []);

  return {
    ...preferencesStore,
    defaults: DEFAULT_INBOX_PREFERENCES,
    limits,
  };
}

export function useInboxQueries({
  filter,
  search,
  feedId,
  folderId,
  itemId,
  includeRead,
  sort,
  timezoneOffsetMinutes,
}: UseInboxQueriesInput) {
  const {
    data: inboxData,
    dataUpdatedAt: inboxDataUpdatedAt,
    fetchNextPage: fetchNextInboxPage,
    hasNextPage: hasNextInboxPage,
    isFetching: isInboxFetching,
    isFetchingNextPage: isInboxFetchingNextPage,
    isPending: isInboxPending,
  } = useInfiniteQuery(
    inboxItemsInfiniteQueryOptions({
      filter,
      search,
      feedId,
      folderId,
      includeRead,
      sort,
      timezoneOffsetMinutes,
    }),
  );

  const {
    data: detailData,
    error: detailError,
    isError: isDetailError,
    isFetching: isDetailFetching,
  } = useQuery(inboxDetailQueryOptions(itemId));

  return {
    detailData,
    detailError,
    fetchNextInboxPage,
    hasNextInboxPage,
    inboxData,
    inboxDataUpdatedAt,
    isDetailError,
    isDetailFetching,
    isInboxFetching,
    isInboxFetchingNextPage,
    isInboxPending,
  };
}

export function useInboxItemStateMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, patch }: InboxItemStateMutationInput) =>
      updateInboxItemState({
        data: {
          itemId,
          ...patch,
        },
      }),
    onMutate: async ({ itemId, patch, removeFromList }) => {
      await queryClient.cancelQueries({ queryKey: ["inbox"] });
      const snapshot = getInboxItemCacheSnapshot(queryClient, itemId);
      updateInboxItemCaches(queryClient, itemId, patch, Boolean(removeFromList));
      return { snapshot };
    },
    onError: (_error, variables, context) => {
      restoreInboxItemCacheSnapshot(queryClient, variables.itemId, context?.snapshot);
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["inbox", "items"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox", "view-count"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox", "item-detail", variables.itemId] });
      void queryClient.invalidateQueries({ queryKey: ["sidebar", "inbox-summary"] });
    },
  });
}

export function useRecordInboxItemView(itemId: string | undefined) {
  const queryClient = useQueryClient();
  const lastRecordedItemIdRef = useRef<string | undefined>(undefined);
  const { mutate } = useMutation({
    mutationFn: (nextItemId: string) =>
      recordInboxItemView({
        data: {
          itemId: nextItemId,
        },
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["inbox", "items"] });
    },
  });

  useEffect(() => {
    if (!itemId) {
      lastRecordedItemIdRef.current = undefined;
      return;
    }
    if (lastRecordedItemIdRef.current === itemId) {
      return;
    }
    lastRecordedItemIdRef.current = itemId;
    mutate(itemId);
  }, [itemId, mutate]);
}
