"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Suspense, type ReactNode, useReducer } from "react";
import { toastManager } from "@kyomi/ui/toast";
import { getUserSafeErrorMessage, logClientError } from "@lib/errors";
import { lazyNamed } from "@lib/lazy-named";
import { usePlatform } from "@hooks/use-platform";
import { exportOpml, followFeed, moveFeedsToFolder } from "@modules/feeds/api";
import { Dialog as CreateFolderDialog } from "@modules/folders/components/create/dialog";
import { inboxRecapQueryKey, inboxRecapQueryOptions } from "@modules/inbox/queries/options";
import { updateInboxItemState } from "@modules/inbox/services/api";
import type { InboxRecapDto } from "@modules/inbox/services/recap-schema";
import { RecapExpandedView, type RecapExpandedSection } from "./expanded-view";
import { Folders } from "./folders";
import { RecapError, RecapSkeleton } from "./sections";
import { TopSources } from "./sections/top-sources";
import type { RecapTopViewedFeed } from "./types";
import { invalidateRecapSurface } from "./utils";
import { WorthRevisiting } from "./sections/worth-revisiting";

const SourcesDialog = lazyNamed(
  () => import("@modules/feeds/components/follow/sources-dialog"),
  "SourcesDialog",
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
  expandedSection: RecapExpandedSection | null;
  exportingOpml: boolean;
  sourcesDialogLoaded: boolean;
  sourcesOpen: boolean;
};

type RecapCardAction =
  | { type: "preload-sources-dialog" }
  | { type: "set-create-folder-open"; open: boolean }
  | { type: "set-expanded-section"; section: RecapExpandedSection | null }
  | { type: "set-exporting-opml"; exporting: boolean }
  | { type: "set-sources-open"; open: boolean };

const initialRecapCardState: RecapCardState = {
  createFolderOpen: false,
  expandedSection: null,
  exportingOpml: false,
  sourcesDialogLoaded: false,
  sourcesOpen: false,
};

function recapCardReducer(state: RecapCardState, action: RecapCardAction): RecapCardState {
  switch (action.type) {
    case "preload-sources-dialog":
      return { ...state, sourcesDialogLoaded: true };
    case "set-create-folder-open":
      return { ...state, createFolderOpen: action.open };
    case "set-expanded-section":
      return { ...state, expandedSection: action.section };
    case "set-exporting-opml":
      return { ...state, exportingOpml: action.exporting };
    case "set-sources-open":
      return { ...state, sourcesOpen: action.open };
  }
}

export function InboxRecapCard() {
  const [
    { createFolderOpen, expandedSection, exportingOpml, sourcesDialogLoaded, sourcesOpen },
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
    mutationFn: (feed: RecapTopViewedFeed) =>
      followFeed({ data: { feedId: feed.feedId, url: feed.url } }),
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
    mutationFn: ({ feedId, folderId }: { feedId: string; folderId: string }) =>
      moveFeedsToFolder({ data: { feedIds: [feedId], folderId } }),
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
    dispatch({ type: "preload-sources-dialog" });
    void SourcesDialog.preload();
  };

  const setSourcesDialogOpen = (open: boolean) => {
    if (open) {
      preloadSourcesDialog();
    }
    dispatch({ type: "set-sources-open", open });
  };

  const followingFeedId =
    followMutation.isPending && followMutation.variables ? followMutation.variables.feedId : null;
  const movingFeedId =
    moveFeedMutation.isPending && moveFeedMutation.variables
      ? moveFeedMutation.variables.feedId
      : null;
  const unsavingItemId =
    unsaveMutation.isPending && unsaveMutation.variables ? unsaveMutation.variables.itemId : null;

  const isFollowingFeed = (feedId: string) => followingFeedId === feedId;

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
        followFeed={(feed) => followMutation.mutate(feed)}
        isFollowingFeed={isFollowingFeed}
        moveFeed={(feedId, folderId) => moveFeedMutation.mutate({ feedId, folderId })}
        movingFeedId={movingFeedId}
        oldestSavedItems={oldestSavedItems}
        section={expandedSection}
        topViewedFeeds={topViewedFeeds}
        unsavingItemId={unsavingItemId}
        onBack={() => dispatch({ type: "set-expanded-section", section: null })}
        onCreateFolder={() => dispatch({ type: "set-create-folder-open", open: true })}
        onExportOpml={exportOpmlAction}
        onImportOpml={() => setSourcesDialogOpen(true)}
        onUnsave={(itemId) => unsaveMutation.mutate({ itemId })}
      />
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
          onImportOpml={() => setSourcesDialogOpen(true)}
        />
        <TopSources
          feeds={topViewedFeeds}
          folders={folders}
          followFeed={(feed) => followMutation.mutate(feed)}
          isFollowingFeed={isFollowingFeed}
          moveFeed={(feedId, folderId) => moveFeedMutation.mutate({ feedId, folderId })}
          movingFeedId={movingFeedId}
          onExpand={() => dispatch({ type: "set-expanded-section", section: "topSources" })}
        />
        <WorthRevisiting
          items={oldestSavedItems}
          onExpand={() =>
            dispatch({ type: "set-expanded-section", section: "worthRevisiting" })
          }
          onUnsave={(itemId) => unsaveMutation.mutate({ itemId })}
          unsavingItemId={unsavingItemId}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm/5">
      {content}

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
        {sourcesDialogLoaded ? (
          <SourcesDialog
            enableGlobalShortcut={false}
            hideTrigger
            open={sourcesOpen}
            onOpenChange={setSourcesDialogOpen}
            platform={platform}
          />
        ) : null}
      </Suspense>
    </div>
  );
}
