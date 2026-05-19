"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateInboxItemState, type InboxItem } from "../services/api";
import { updateInboxItemCaches } from "../queries/cache";

export type InboxItemPatch = Partial<Pick<InboxItem, "isRead" | "isSaved">>;

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
      await queryClient.cancelQueries({ queryKey: ["inbox"] });
      updateInboxItemCaches(queryClient, itemId, patch, Boolean(removeFromList));
    },
    onSettled: (_data, _error, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["inbox", "items"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox", "view-count"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox", "item-detail", variables.itemId] });
      void queryClient.invalidateQueries({ queryKey: ["sidebar", "inbox-summary"] });
    },
  });
}
