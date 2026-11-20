"use client";

import { editFlags } from "@kyomi/reader/offline";
import { library, owner as offlineOwner } from "@lib/offline/store";
import { syncLibrary } from "@lib/offline/sync";
import { useAuth } from "@integrations/better-auth/provider";
import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toastManager } from "@kyomi/ui/components/toast";
import { logClientError } from "@kyomi/reader/lib/errors";
import { recordInboxItemView, updateInboxItemState, type InboxItem } from "../lib/api";
import {
  getInboxItemCacheSnapshot,
  restoreInboxItemCacheSnapshot,
  updateInboxItemCaches,
} from "../queries/cache";
import { queryKeys } from "@lib/query/keys";

type InboxItemPatch = Partial<Pick<InboxItem, "isRead" | "isSaved">> & {
  isHidden?: boolean;
};

type InboxItemStateMutationInput = {
  itemId: string;
  patch: InboxItemPatch;
  removeFromList?: boolean;
};

/**
 * `reportErrors: false` lets a caller that owns its own failure copy (for example the save action)
 * handle the error instead of getting the generic toast as well.
 */
export function useInboxItemStateMutation({
  reportErrors = true,
}: { reportErrors?: boolean } = {}) {
  const queryClient = useQueryClient();

  const { user } = useAuth();
  return useMutation({
    networkMode: "always",
    mutationFn: async ({ itemId, patch }: InboxItemStateMutationInput) => {
      if (user && patch.isHidden === undefined && typeof indexedDB !== "undefined") {
        const detail = getInboxItemCacheSnapshot(queryClient, itemId).detail?.item;
        await editFlags(library, user.id, itemId, patch, detail ?? undefined);
        await syncLibrary(user.id).catch(() => {});
        return { message: "Saved on device" };
      }
      return updateInboxItemState({
        data: {
          itemId,
          ...patch,
        },
      });
    },
    onMutate: async ({ itemId, patch, removeFromList }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.inbox.all });
      const snapshot = getInboxItemCacheSnapshot(queryClient, itemId);
      updateInboxItemCaches(queryClient, itemId, patch, Boolean(removeFromList));
      return { snapshot };
    },
    onError: async (error, variables, context) => {
      if (
        user &&
        typeof indexedDB !== "undefined" &&
        (await offlineOwner().catch(() => null)) !== user.id
      )
        return;
      restoreInboxItemCacheSnapshot(queryClient, variables.itemId, context?.snapshot);
      if (!reportErrors) {
        return;
      }
      logClientError("articles.item-state.update", error);
      toastManager.add({
        title: "Unable to update article",
        type: "error",
      });
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
