"use client";

import { useMutation, type QueryClient } from "@tanstack/react-query";
import { anchoredToastManager, toastManager } from "@kyomi/ui/toast";
import { logClientError } from "@lib/errors";
import { followFeed, unfollowFeed } from "@modules/feeds/lib/api";
import { moveFeedsToFolder } from "@modules/folders/lib/api";
import { updateInboxItemState } from "@modules/inbox/lib/articles/index";
import { invalidateRecapSurface } from "@modules/inbox/lib/recap/index";
import type { InboxRecapDto } from "@modules/inbox/lib/recap/schema";
import { inboxRecapQueryKey } from "@modules/inbox/queries/options";
import type { RecapTopViewedFeed } from "./types";

type FollowTopSourceInput = {
  feed: RecapTopViewedFeed;
  folderId?: string;
};

type RemoveFeedsInput = {
  anchor?: HTMLElement | null;
  feedIds: string[];
  feedName?: string;
};

export function useUnsaveRecapItemMutation(queryClient: QueryClient) {
  return useMutation({
    mutationFn: ({ itemId }: { itemId: string }) =>
      updateInboxItemState({ data: { itemId, isSaved: false } }),
    onMutate: async ({ itemId }) => {
      await queryClient.cancelQueries({ queryKey: inboxRecapQueryKey() });
      const snapshot = queryClient.getQueryData<InboxRecapDto>(inboxRecapQueryKey());
      queryClient.setQueryData<InboxRecapDto>(inboxRecapQueryKey(), (current) =>
        current
          ? {
              ...current,
              oldestSavedItems: current.oldestSavedItems.filter((item) => item.id !== itemId),
            }
          : current,
      );
      return { snapshot };
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: inboxRecapQueryKey() }),
        invalidateRecapSurface(queryClient),
      ]);
    },
    onError: (error, _variables, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(inboxRecapQueryKey(), context.snapshot);
      }
      logClientError("inbox.recap.saved.unsave", error);
      toastManager.add({
        title: "Unable to unsave item",
        type: "error",
      });
    },
  });
}

export function useFollowTopSourceMutation(queryClient: QueryClient) {
  return useMutation({
    mutationFn: async ({ feed, folderId }: FollowTopSourceInput) => {
      const followed = await followFeed({ data: { feedId: feed.feedId, url: feed.url } });

      if (folderId) {
        await moveFeedsToFolder({ data: { feedIds: [followed.feedId], folderId } });
      }

      return followed;
    },
    onSuccess: async (feed) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: inboxRecapQueryKey() }),
        invalidateRecapSurface(queryClient),
      ]);
      toastManager.add({
        title: `Following ${feed.title}`,
        type: "success",
      });
    },
    onError: (error) => {
      logClientError("inbox.recap.feed.follow", error);
      toastManager.add({
        title: "Unable to follow feed",
        type: "error",
      });
    },
  });
}

export function useMoveRecapFeedMutation(queryClient: QueryClient) {
  return useMutation({
    mutationFn: ({ feedIds, folderId }: { feedIds: string[]; folderId: string }) =>
      moveFeedsToFolder({ data: { feedIds, folderId } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: inboxRecapQueryKey() }),
        invalidateRecapSurface(queryClient),
      ]);
    },
    onError: (error) => {
      logClientError("inbox.recap.feed.move", error);
      toastManager.add({
        title: "Unable to move feed",
        type: "error",
      });
    },
  });
}

export function useRemoveRecapFeedsMutation(queryClient: QueryClient) {
  // oxlint-disable-next-line react-doctor/query-mutation-missing-invalidation -- invalidateRecapSurface invalidates inboxRecapQueryKey and related recap/sidebar surfaces.
  return useMutation({
    mutationFn: async ({ feedIds }: RemoveFeedsInput) => {
      await Promise.all(feedIds.map((feedId) => unfollowFeed({ data: { feedId } })));
      return { feedIds };
    },
    onSuccess: async ({ feedIds }, variables) => {
      const toastAnchor = variables.anchor?.isConnected ? variables.anchor : null;
      const feedName = variables.feedName;
      const shouldShowAnchoredToast = feedIds.length === 1 && Boolean(feedName && toastAnchor);

      if (shouldShowAnchoredToast && feedName && toastAnchor) {
        anchoredToastManager.add({
          title: `Unfollowed ${feedName}`,
          type: "success",
          timeout: 1800,
          data: { tooltipStyle: true },
          positionerProps: {
            anchor: toastAnchor,
            side: "top",
            align: "center",
            sideOffset: 6,
            positionMethod: "fixed",
          },
        });
      }

      // oxlint-disable-next-line react-doctor/async-defer-await -- invalidation must run on every path, not just the toast path.
      await invalidateRecapSurface(queryClient);
      if (shouldShowAnchoredToast) {
        return;
      }

      toastManager.add({
        title: feedIds.length === 1 ? "Feed removed" : `${feedIds.length} feeds removed`,
        type: "success",
      });
    },
    onError: (error) => {
      logClientError("inbox.recap.feed.remove", error);
      toastManager.add({
        title: "Unable to remove feed",
        type: "error",
      });
    },
  });
}
