"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, useCallback, useReducer, type Dispatch } from "react";
import { Transition, type TransitionDirection } from "@kyomi/ui/transition";
import { toastManager } from "@kyomi/ui/toast";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import { lazyNamed } from "@lib/lazy-named";
import { usePlatform } from "@hooks/use-platform";
import { useTransition } from "@hooks/use-transition";
import { exportOpml } from "@modules/feeds/lib/api";
import { CreateFolderDialog } from "@modules/folders/components/dialog";
import type { useInboxRouteState } from "@modules/inbox/hooks/use-layout";
import { inboxRecapQueryOptions } from "@modules/inbox/queries/options";
import { RecapContent } from "./content";
import type {
  InboxRecapRailFolderBackTarget,
  InboxRecapRailSection,
} from "@modules/inbox/lib/recap/index";
import { invalidateRecapSurface } from "@modules/inbox/lib/recap/index";
import type { InboxRecapDto } from "@modules/inbox/lib/recap/schema";
import {
  useFollowTopSourceMutation,
  useMoveRecapFeedMutation,
  useRemoveRecapFeedsMutation,
  useUnsaveRecapItemMutation,
} from "./mutations";
import {
  getRecapScreenKey,
  RECAP_NAVIGATION_TRANSITION,
  RECAP_TRANSITION_OFFSET,
} from "./screen-key";

const FollowSourcesDialog = lazyNamed(
  () => import("@modules/feeds/components/follow/dialog"),
  "FollowSourcesDialog",
);

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

type RecapCardState = {
  createFolderOpen: boolean;
  exportingOpml: boolean;
  followSourcesDialogLoaded: boolean;
  followSourcesOpen: boolean;
  navigationDirection: TransitionDirection;
};

type RecapCardAction =
  | { type: "preload-follow-sources" }
  | { type: "set-create-folder-open"; open: boolean }
  | { type: "set-exporting-opml"; exporting: boolean }
  | { type: "set-follow-sources-open"; open: boolean }
  | { type: "set-navigation-direction"; direction: TransitionDirection };

const initialRecapCardState: RecapCardState = {
  createFolderOpen: false,
  exportingOpml: false,
  followSourcesDialogLoaded: false,
  followSourcesOpen: false,
  navigationDirection: "forward",
};

function recapCardReducer(state: RecapCardState, action: RecapCardAction): RecapCardState {
  switch (action.type) {
    case "preload-follow-sources":
      return { ...state, followSourcesDialogLoaded: true };
    case "set-create-folder-open":
      return { ...state, createFolderOpen: action.open };
    case "set-exporting-opml":
      return { ...state, exportingOpml: action.exporting };
    case "set-follow-sources-open":
      return { ...state, followSourcesOpen: action.open };
    case "set-navigation-direction":
      return { ...state, navigationDirection: action.direction };
  }
}

type RecapNavigationInput = {
  direction?: TransitionDirection;
  rail: InboxRecapRailSection | null;
  railFolderBack?: InboxRecapRailFolderBackTarget;
  railFolderId?: string | null;
};

type RecapData = InboxRecapDto;
type RecapPendingState = {
  followingFeedId: string | null;
  movingFeedId: string | null;
  movingFeedIds: string[];
  removingFeedIds: string[];
  unsavingItemId: string | null;
};
type RecapMutationState = {
  followMutation: ReturnType<typeof useFollowTopSourceMutation>;
  moveFeedMutation: ReturnType<typeof useMoveRecapFeedMutation>;
  removeFeedsMutation: ReturnType<typeof useRemoveRecapFeedsMutation>;
  unsaveMutation: ReturnType<typeof useUnsaveRecapItemMutation>;
};

function getSelectedFolderState({
  rail,
  railFolderBack,
  railFolderId,
}: {
  rail?: InboxRecapRailSection;
  railFolderBack?: InboxRecapRailFolderBackTarget;
  railFolderId?: string;
}) {
  if (rail !== "folders") {
    return { selectedFolderBackTarget: null, selectedFolderId: null };
  }

  const selectedFolderId = railFolderId ?? null;
  return {
    selectedFolderId,
    selectedFolderBackTarget: selectedFolderId ? (railFolderBack ?? "folders") : null,
  };
}

function getRecapCollections(recap?: RecapData) {
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

function getRecapPendingState({
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

function useRecapNavigation({
  dispatch,
  navigate,
  rail,
}: {
  dispatch: Dispatch<RecapCardAction>;
  navigate: ReturnType<typeof useInboxRouteState>["navigate"];
  rail?: InboxRecapRailSection;
}) {
  return useCallback(
    ({
      direction = rail ? "backward" : "forward",
      rail: nextRail,
      railFolderBack: nextRailFolderBack,
      railFolderId: nextRailFolderId,
    }: RecapNavigationInput) => {
      dispatch({ type: "set-navigation-direction", direction });
      void navigate({
        search: (prev) => ({
          ...prev,
          rail: nextRail ?? undefined,
          railFolderBack:
            nextRail === "folders" && nextRailFolderId ? nextRailFolderBack : undefined,
          railFolderId: nextRail === "folders" ? (nextRailFolderId ?? undefined) : undefined,
        }),
      });
    },
    [dispatch, navigate, rail],
  );
}

function useExportOpmlAction({
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
      description: exported.filename,
      type: "success",
    });
  } catch (error) {
    logClientError("inbox.recap.opml.export", error);
    toastManager.add({
      title: "Unable to export OPML",
      description: getUserSafeErrorMessage(error, "Try again in a moment."),
      type: "error",
    });
  } finally {
    dispatch({ type: "set-exporting-opml", exporting: false });
  }
}

function RecapDialogs({
  createFolderOpen,
  followSourcesDialogLoaded,
  followSourcesOpen,
  platform,
  queryClient,
  setFollowSourcesDialogOpen,
  dispatch,
}: {
  createFolderOpen: boolean;
  followSourcesDialogLoaded: boolean;
  followSourcesOpen: boolean;
  platform: ReturnType<typeof usePlatform>;
  queryClient: ReturnType<typeof useQueryClient>;
  setFollowSourcesDialogOpen: (open: boolean) => void;
  dispatch: Dispatch<RecapCardAction>;
}) {
  return (
    <>
      <CreateFolderDialog
        hideTrigger
        open={createFolderOpen}
        onOpenChange={(open) => {
          dispatch({ type: "set-create-folder-open", open });
          if (!open) {
            void invalidateRecapSurface(queryClient);
          }
        }}
      />
      <Suspense fallback={null}>
        {followSourcesDialogLoaded ? (
          <FollowSourcesDialog
            enableGlobalShortcut={false}
            hideTrigger
            open={followSourcesOpen}
            onOpenChange={setFollowSourcesDialogOpen}
            platform={platform}
          />
        ) : null}
      </Suspense>
    </>
  );
}

export function InboxRecapCard({
  navigate,
  rail,
  railFolderBack,
  railFolderId,
}: {
  navigate: ReturnType<typeof useInboxRouteState>["navigate"];
  rail?: InboxRecapRailSection;
  railFolderBack?: InboxRecapRailFolderBackTarget;
  railFolderId?: string;
}) {
  const [
    {
      createFolderOpen,
      exportingOpml,
      followSourcesDialogLoaded,
      followSourcesOpen,
      navigationDirection,
    },
    dispatch,
  ] = useReducer(recapCardReducer, initialRecapCardState);
  const expandedSection = rail ?? null;
  const { selectedFolderBackTarget, selectedFolderId } = getSelectedFolderState({
    rail,
    railFolderBack,
    railFolderId,
  });
  const platform = usePlatform();
  const queryClient = useQueryClient();
  const {
    data: recap,
    isError: recapError,
    isLoading: recapLoading,
    refetch: refetchRecap,
  } = useQuery(inboxRecapQueryOptions(10));

  const { folders, isSummaryEmpty, oldestSavedItems, topViewedFeeds } = getRecapCollections(recap);

  const unsaveMutation = useUnsaveRecapItemMutation(queryClient);
  const followMutation = useFollowTopSourceMutation(queryClient);
  const moveFeedMutation = useMoveRecapFeedMutation(queryClient);
  const removeFeedsMutation = useRemoveRecapFeedsMutation(queryClient);

  const exportOpmlAction = useExportOpmlAction({ dispatch, exportingOpml });

  const preloadSourcesDialog = () => {
    dispatch({ type: "preload-follow-sources" });
    void FollowSourcesDialog.preload();
  };

  const setFollowSourcesDialogOpen = (open: boolean) => {
    if (open) {
      preloadSourcesDialog();
    }
    dispatch({ type: "set-follow-sources-open", open });
  };

  const { followingFeedId, movingFeedId, movingFeedIds, removingFeedIds, unsavingItemId } =
    getRecapPendingState({
      followMutation,
      moveFeedMutation,
      removeFeedsMutation,
      unsaveMutation,
    });

  const isFollowingFeed = (feedId: string) => followingFeedId === feedId;
  const navigateRecap = useRecapNavigation({ dispatch, navigate, rail });
  const recapScreenKey = getRecapScreenKey({ expandedSection });
  const recapTransition = useTransition({
    className: "relative min-h-0 min-w-0 flex-1 overflow-hidden",
    contentKey: recapScreenKey,
    direction: navigationDirection,
    mode: "sync",
    offset: RECAP_TRANSITION_OFFSET,
    transition: RECAP_NAVIGATION_TRANSITION[navigationDirection],
  });

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm/5">
      <Transition {...recapTransition}>
        <RecapContent
          expandedSection={expandedSection}
          exportingOpml={exportingOpml}
          folders={folders}
          followFeed={(feed, folderId) => followMutation.mutate({ feed, folderId })}
          isFollowingFeed={isFollowingFeed}
          isSummaryEmpty={isSummaryEmpty}
          moveFeed={(feedId, folderId) => moveFeedMutation.mutate({ feedIds: [feedId], folderId })}
          moveFeeds={(feedIds, folderId) => moveFeedMutation.mutate({ feedIds, folderId })}
          movingFeedId={movingFeedId}
          movingFeedIds={movingFeedIds}
          navigateRecap={navigateRecap}
          oldestSavedItems={oldestSavedItems}
          recapError={recapError}
          recapLoading={recapLoading}
          refetchRecap={() => void refetchRecap()}
          removeFeeds={(feedIds, options) => removeFeedsMutation.mutate({ feedIds, ...options })}
          removingFeedIds={removingFeedIds}
          selectedFolderBackTarget={selectedFolderBackTarget}
          selectedFolderId={selectedFolderId}
          topViewedFeeds={topViewedFeeds}
          unsavingItemId={unsavingItemId}
          onCreateFolder={() => dispatch({ type: "set-create-folder-open", open: true })}
          onExportOpml={exportOpmlAction}
          onImportOpml={() => setFollowSourcesDialogOpen(true)}
          onUnsave={(itemId) => unsaveMutation.mutate({ itemId })}
        />
      </Transition>

      <RecapDialogs
        createFolderOpen={createFolderOpen}
        dispatch={dispatch}
        followSourcesDialogLoaded={followSourcesDialogLoaded}
        followSourcesOpen={followSourcesOpen}
        platform={platform}
        queryClient={queryClient}
        setFollowSourcesDialogOpen={setFollowSourcesDialogOpen}
      />
    </div>
  );
}
