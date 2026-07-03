"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AddFill, Folder2Fill } from "@mingcute/react";
import { Suspense, type ReactNode, useReducer } from "react";
import { Button } from "@kyomi/ui/button";
import { Transition, type TransitionDirection } from "@kyomi/ui/transition";
import { anchoredToastManager, toastManager } from "@kyomi/ui/toast";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import { lazyNamed } from "@lib/lazy-named";
import { usePlatform } from "@hooks/use-platform";
import { useTransition } from "@hooks/use-transition";
import { exportOpml, followFeed, unfollowFeed } from "@modules/feeds/lib/api";
import { CreateFolderDialog } from "@modules/folders/components/dialog";
import { Folders } from "@modules/folders/components/recap/summary";
import { moveFeedsToFolder } from "@modules/folders/lib/api";
import { inboxRecapQueryKey, inboxRecapQueryOptions } from "@modules/inbox/queries/options";
import { updateInboxItemState } from "@modules/inbox/services/api";
import type { InboxRecapDto } from "@modules/inbox/services/recap-schema";
import { RecapExpandedView, type RecapExpandedSection } from "./expanded";
import { RecapError, RecapSkeleton, SectionEmpty } from "./sections";
import { TopSources } from "./sections/top-sources";
import type { RecapTopViewedFeed } from "./types";
import { invalidateRecapSurface } from "./utils";
import { WorthRevisiting } from "./sections/worth-revisiting";

const FollowSourcesDialog = lazyNamed(
  () => import("@modules/feeds/components/follow/dialog"),
  "FollowSourcesDialog",
);

const RECAP_TRANSITION_OFFSET_PX = 28;

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
  expandedSection: RecapExpandedSection | null;
  exportingOpml: boolean;
  followSourcesDialogLoaded: boolean;
  followSourcesOpen: boolean;
  navigationDirection: TransitionDirection;
};

type RecapCardAction =
  | { type: "preload-follow-sources" }
  | { type: "set-create-folder-open"; open: boolean }
  | {
      type: "set-expanded-section";
      section: RecapExpandedSection | null;
      direction?: TransitionDirection;
    }
  | { type: "set-exporting-opml"; exporting: boolean }
  | { type: "set-follow-sources-open"; open: boolean };

type FollowTopSourceInput = {
  feed: RecapTopViewedFeed;
  folderId?: string;
};
type RemoveFeedsInput = {
  anchor?: HTMLElement | null;
  feedIds: string[];
  feedName?: string;
};

const initialRecapCardState: RecapCardState = {
  createFolderOpen: false,
  expandedSection: null,
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
    case "set-expanded-section":
      return {
        ...state,
        expandedSection: action.section,
        navigationDirection: action.direction ?? (action.section ? "forward" : "backward"),
      };
    case "set-exporting-opml":
      return { ...state, exportingOpml: action.exporting };
    case "set-follow-sources-open":
      return { ...state, followSourcesOpen: action.open };
  }
}

export function InboxRecapCard() {
  const [
    {
      createFolderOpen,
      expandedSection,
      exportingOpml,
      followSourcesDialogLoaded,
      followSourcesOpen,
      navigationDirection,
    },
    dispatch,
  ] = useReducer(recapCardReducer, initialRecapCardState);
  const platform = usePlatform();
  const queryClient = useQueryClient();
  const {
    data: recap,
    isError: recapError,
    isLoading: recapLoading,
    refetch: refetchRecap,
  } = useQuery(inboxRecapQueryOptions(10));

  const folders = recap?.folders ?? [];
  const topViewedFeeds = recap?.topViewedFeeds ?? [];
  const oldestSavedItems = recap?.oldestSavedItems ?? [];
  const isSummaryEmpty =
    folders.length === 0 && topViewedFeeds.length === 0 && oldestSavedItems.length === 0;

  const unsaveMutation = useMutation({
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
        description: getUserSafeErrorMessage(error, "Try again in a moment."),
        type: "error",
      });
    },
  });

  const followMutation = useMutation({
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
        title: "Feed followed",
        description: feed.title,
        type: "success",
      });
    },
    onError: (error) => {
      logClientError("inbox.recap.feed.follow", error);
      toastManager.add({
        title: "Unable to follow feed",
        description: getUserSafeErrorMessage(error, "Try again in a moment."),
        type: "error",
      });
    },
  });

  const moveFeedMutation = useMutation({
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
        description: getUserSafeErrorMessage(error, "Try again in a moment."),
        type: "error",
      });
    },
  });

  const removeFeedsMutation = useMutation({
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

      await invalidateRecapSurface(queryClient);
      if (shouldShowAnchoredToast) {
        return;
      }

      toastManager.add({
        title: feedIds.length === 1 ? "Feed removed" : "Feeds removed",
        description:
          feedIds.length === 1
            ? "The selected feed has been removed from your following."
            : `${feedIds.length} selected feeds were removed from your following.`,
        type: "success",
      });
    },
    onError: (error) => {
      logClientError("inbox.recap.feed.remove", error);
      toastManager.add({
        title: "Unable to remove feed",
        description: getUserSafeErrorMessage(error, "Try again in a moment."),
        type: "error",
      });
    },
  });

  const handleExportOpml = async () => {
    if (exportingOpml) {
      return;
    }

    dispatch({ type: "set-exporting-opml", exporting: true });
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
  };

  const exportOpmlAction = () => {
    void handleExportOpml();
  };

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

  const followingFeedId =
    followMutation.isPending && followMutation.variables
      ? followMutation.variables.feed.feedId
      : null;
  const movingFeedId =
    moveFeedMutation.isPending && moveFeedMutation.variables
      ? moveFeedMutation.variables.feedIds.length === 1
        ? moveFeedMutation.variables.feedIds[0]
        : null
      : null;
  const movingFeedIds =
    moveFeedMutation.isPending && moveFeedMutation.variables
      ? moveFeedMutation.variables.feedIds
      : [];
  const removingFeedIds =
    removeFeedsMutation.isPending && removeFeedsMutation.variables
      ? removeFeedsMutation.variables.feedIds
      : [];
  const unsavingItemId =
    unsaveMutation.isPending && unsaveMutation.variables ? unsaveMutation.variables.itemId : null;

  const isFollowingFeed = (feedId: string) => followingFeedId === feedId;
  const recapScreenKey = recapLoading
    ? "recap-loading"
    : recapError
      ? "recap-error"
      : expandedSection
        ? `recap-expanded-${expandedSection}`
        : "recap-summary";

  let content: ReactNode;
  if (recapLoading) {
    content = <RecapSkeleton />;
  } else if (recapError) {
    content = <RecapError onRetry={() => void refetchRecap()} />;
  } else if (expandedSection) {
    content = (
      <RecapExpandedView
        exportingOpml={exportingOpml}
        folders={folders}
        followFeed={(feed, folderId) => followMutation.mutate({ feed, folderId })}
        isFollowingFeed={isFollowingFeed}
        moveFeed={(feedId, folderId) => moveFeedMutation.mutate({ feedIds: [feedId], folderId })}
        moveFeeds={(feedIds, folderId) => moveFeedMutation.mutate({ feedIds, folderId })}
        movingFeedIds={movingFeedIds}
        movingFeedId={movingFeedId}
        oldestSavedItems={oldestSavedItems}
        removeFeeds={(feedIds, options) => removeFeedsMutation.mutate({ feedIds, ...options })}
        removingFeedIds={removingFeedIds}
        section={expandedSection}
        topViewedFeeds={topViewedFeeds}
        unsavingItemId={unsavingItemId}
        onBack={() =>
          dispatch({ type: "set-expanded-section", section: null, direction: "backward" })
        }
        onCreateFolder={() => dispatch({ type: "set-create-folder-open", open: true })}
        onExportOpml={exportOpmlAction}
        onImportOpml={() => setFollowSourcesDialogOpen(true)}
        onUnsave={(itemId) => unsaveMutation.mutate({ itemId })}
      />
    );
  } else if (isSummaryEmpty) {
    content = (
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-4">
        <SectionEmpty
          title="Nothing here yet"
          description="Folders, top sources, and saved items will appear here as you read and organize feeds."
          icon={<Folder2Fill />}
          action={
            <Button
              size="sm"
              onClick={() => dispatch({ type: "set-create-folder-open", open: true })}
            >
              <AddFill />
              Create folder
            </Button>
          }
        />
      </div>
    );
  } else {
    content = (
      <div className="grid min-h-0 flex-1 grid-rows-3 gap-4 overflow-hidden py-4">
        <Folders
          exportingOpml={exportingOpml}
          folders={folders}
          onExpand={() => dispatch({ type: "set-expanded-section", section: "folders" })}
          onCreateFolder={() => dispatch({ type: "set-create-folder-open", open: true })}
          onExportOpml={exportOpmlAction}
          onImportOpml={() => setFollowSourcesDialogOpen(true)}
        />
        <TopSources
          feeds={topViewedFeeds}
          folders={folders}
          followFeed={(feed, folderId) => followMutation.mutate({ feed, folderId })}
          isFollowingFeed={isFollowingFeed}
          moveFeed={(feedId, folderId) => moveFeedMutation.mutate({ feedIds: [feedId], folderId })}
          movingFeedId={movingFeedId}
          onExpand={() => dispatch({ type: "set-expanded-section", section: "topSources" })}
        />
        <WorthRevisiting
          items={oldestSavedItems}
          onExpand={() => dispatch({ type: "set-expanded-section", section: "worthRevisiting" })}
          onUnsave={(itemId) => unsaveMutation.mutate({ itemId })}
          unsavingItemId={unsavingItemId}
        />
      </div>
    );
  }
  const recapTransition = useTransition({
    className: "relative min-h-0 min-w-0 flex-1 overflow-hidden",
    contentKey: recapScreenKey,
    direction: navigationDirection,
    mode: "popLayout",
    offset: RECAP_TRANSITION_OFFSET_PX,
  });

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm/5">
      <Transition {...recapTransition}>{content}</Transition>

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
    </div>
  );
}
