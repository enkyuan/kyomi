"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { recordInboxItemView, updateInboxItemState, type InboxItem } from "../lib/api";
import {
  getInboxItemCacheSnapshot,
  restoreInboxItemCacheSnapshot,
  updateInboxItemCaches,
} from "../queries/cache";
import { queryKeys } from "@lib/query/keys";

export type InboxItemPatch = Partial<Pick<InboxItem, "isRead" | "isSaved">> & {
  isHidden?: boolean;
};

type InboxItemStateMutationInput = {
  itemId: string;
  patch: InboxItemPatch;
  removeFromList?: boolean;
};

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
      await queryClient.cancelQueries({ queryKey: queryKeys.inbox.all });
      const snapshot = getInboxItemCacheSnapshot(queryClient, itemId);
      updateInboxItemCaches(queryClient, itemId, patch, Boolean(removeFromList));
      return { snapshot };
    },
    onError: (_error, variables, context) => {
      restoreInboxItemCacheSnapshot(queryClient, variables.itemId, context?.snapshot);
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.inbox.items });
      void queryClient.invalidateQueries({ queryKey: queryKeys.inbox.viewCount });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.inbox.itemDetail(variables.itemId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sidebar.inboxSummary });
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.inbox.items });
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
