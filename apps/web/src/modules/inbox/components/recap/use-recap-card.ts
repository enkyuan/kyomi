"use client";

import { useCallback, type Dispatch } from "react";
import { toastManager } from "@kyomi/ui/components/toast";
import { logClientError } from "@kyomi/reader/lib/errors";
import { exportOpml } from "@modules/feeds/lib/api";
import type { InboxRecapDto } from "@modules/inbox/lib/recap/schema";
import type {
  useFollowTopSourceMutation,
  useMoveRecapFeedMutation,
  useRemoveRecapFeedsMutation,
  useUnsaveRecapItemMutation,
} from "../../hooks/use-recap-mutations";

function downloadOpmlExport({ filename, xml }: { filename: string; xml: string }) {
  const url = URL.createObjectURL(new Blob([xml], { type: "application/xml;charset=utf-8" }));
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export type RecapCardState = {
  createFolderOpen: boolean;
  exportingOpml: boolean;
  followSourcesDialogLoaded: boolean;
  followSourcesOpen: boolean;
};

export type RecapCardAction =
  | { type: "preload-follow-sources" }
  | { type: "set-create-folder-open"; open: boolean }
  | { type: "set-exporting-opml"; exporting: boolean }
  | { type: "set-follow-sources-open"; open: boolean };

export const initialRecapCardState: RecapCardState = {
  createFolderOpen: false,
  exportingOpml: false,
  followSourcesDialogLoaded: false,
  followSourcesOpen: false,
};

export function recapCardReducer(state: RecapCardState, action: RecapCardAction): RecapCardState {
  switch (action.type) {
    case "preload-follow-sources":
      return { ...state, followSourcesDialogLoaded: true };
    case "set-create-folder-open":
      return { ...state, createFolderOpen: action.open };
    case "set-exporting-opml":
      return { ...state, exportingOpml: action.exporting };
    case "set-follow-sources-open":
      return { ...state, followSourcesOpen: action.open };
  }
}

export type RecapData = InboxRecapDto;
export type RecapPendingState = {
  followingFeedId: string | null;
  movingFeedId: string | null;
  movingFeedIds: string[];
  removingFeedIds: string[];
  unsavingItemId: string | null;
};
export type RecapMutationState = {
  followMutation: ReturnType<typeof useFollowTopSourceMutation>;
  moveFeedMutation: ReturnType<typeof useMoveRecapFeedMutation>;
  removeFeedsMutation: ReturnType<typeof useRemoveRecapFeedsMutation>;
  unsaveMutation: ReturnType<typeof useUnsaveRecapItemMutation>;
};

export function getRecapCollections(recap?: RecapData) {
  const folders = recap?.folders ?? [];
  const topViewedFeeds = recap?.topViewedFeeds ?? [];
  const oldestSavedItems = recap?.oldestSavedItems ?? [];

  return {
    folders,
    topViewedFeeds,
    oldestSavedItems,
    isSummaryEmpty:
      folders.length === 0 && topViewedFeeds.length === 0 && oldestSavedItems.length === 0,
  };
}

export function getRecapPendingState({
  followMutation,
  moveFeedMutation,
  removeFeedsMutation,
  unsaveMutation,
}: RecapMutationState): RecapPendingState {
  const movingFeedIds =
    moveFeedMutation.isPending && moveFeedMutation.variables
      ? moveFeedMutation.variables.feedIds
      : [];

  return {
    followingFeedId:
      followMutation.isPending && followMutation.variables
        ? followMutation.variables.feed.feedId
        : null,
    movingFeedId:
      movingFeedIds.length === 1 && moveFeedMutation.isPending ? movingFeedIds[0] : null,
    movingFeedIds,
    removingFeedIds:
      removeFeedsMutation.isPending && removeFeedsMutation.variables
        ? removeFeedsMutation.variables.feedIds
        : [],
    unsavingItemId:
      unsaveMutation.isPending && unsaveMutation.variables ? unsaveMutation.variables.itemId : null,
  };
}

export function useExportOpmlAction({
  dispatch,
  exportingOpml,
}: {
  dispatch: Dispatch<RecapCardAction>;
  exportingOpml: boolean;
}) {
  return useCallback(() => {
    if (exportingOpml) {
      return;
    }

    dispatch({ type: "set-exporting-opml", exporting: true });
    void exportRecapOpml(dispatch);
  }, [dispatch, exportingOpml]);
}

async function exportRecapOpml(dispatch: Dispatch<RecapCardAction>) {
  try {
    const exported = await exportOpml();
    downloadOpmlExport(exported);
    toastManager.add({
      title: "OPML exported",
      type: "success",
    });
  } catch (error) {
    logClientError("inbox.recap.opml.export", error);
    toastManager.add({
      title: "Unable to export OPML",
      type: "error",
    });
  } finally {
    dispatch({ type: "set-exporting-opml", exporting: false });
  }
}
