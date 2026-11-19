"use client";

import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  springTransition,
  useReducedMotion,
} from "@kyomi/ui/lib/motion";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate as useRouterNavigate, useSearch } from "@tanstack/react-router";
import { buildInboxItemSlug } from "@modules/articles/lib/slug";
import type { InboxSearch } from "@modules/inbox/lib/search";
import { Suspense, useReducer, useState, type Dispatch } from "react";
import { lazyNamed } from "@lib/lazy-named";
import { usePlatform } from "@hooks/use-platform";
import { CreateFolderDialog } from "@modules/folders/components/create-dialog";
import type { useInboxRouteState } from "@modules/inbox/hooks/use-layout";
import {
  continueReadingQueryOptions,
  inboxRecapQueryOptions,
} from "@modules/inbox/queries/options";
import { RecapContent } from "./content";
import { RecapCommand, type RecapCommandMenu } from "./command";
import {
  getRecapCollections,
  getRecapPendingState,
  initialRecapCardState,
  recapCardReducer,
  useExportOpmlAction,
  type RecapCardAction,
} from "./use-recap-card";
import { invalidateRecapSurface } from "@modules/inbox/lib/recap/index";
import {
  useDismissContinueReadingMutation,
  useFollowTopSourceMutation,
  useMoveRecapFeedMutation,
  useRemoveRecapFeedsMutation,
  useUnsaveRecapItemMutation,
} from "../../hooks/use-recap-mutations";

const FollowSourcesDialog = lazyNamed(
  () => import("@modules/feeds/components/follow/dialog"),
  "FollowSourcesDialog",
);

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

function RecapCard({ navigate }: { navigate: ReturnType<typeof useInboxRouteState>["navigate"] }) {
  const [
    { createFolderOpen, exportingOpml, followSourcesDialogLoaded, followSourcesOpen },
    dispatch,
  ] = useReducer(recapCardReducer, initialRecapCardState);
  const platform = usePlatform();
  const [menu, setMenu] = useState<RecapCommandMenu>({ open: false, page: "root" });
  const { search } = useSearch({ strict: false });
  const routerNavigate = useRouterNavigate();
  const queryClient = useQueryClient();
  const {
    data: recap,
    isError: recapError,
    isLoading: recapLoading,
    refetch: refetchRecap,
  } = useQuery(inboxRecapQueryOptions(10));

  // Loads with the recap so the rail settles once, instead of growing a row when this arrives.
  const { data: continueReading, isLoading: continueReadingLoading } = useQuery(
    continueReadingQueryOptions(),
  );
  const continueReadingItems = continueReading?.items ?? [];

  const { folders, isSummaryEmpty, oldestSavedItems, topViewedFeeds } = getRecapCollections(recap);

  const dismissContinueReadingMutation = useDismissContinueReadingMutation(queryClient);
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

  const { followingFeedId, movingFeedId, unsavingItemId } = getRecapPendingState({
    followMutation,
    moveFeedMutation,
    removeFeedsMutation,
    unsaveMutation,
  });

  const isFollowingFeed = (feedId: string) => followingFeedId === feedId;
  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden text-foreground">
      <RecapCommand
        activeSearch={search}
        continueReadingItems={continueReadingItems}
        oldestSavedItems={oldestSavedItems}
        topViewedFeeds={topViewedFeeds}
        exportingOpml={exportingOpml}
        folders={folders}
        menu={menu}
        moveFeed={(feedId, folderId) => moveFeedMutation.mutate({ feedIds: [feedId], folderId })}
        onExportOpml={exportOpmlAction}
        onMenuChange={setMenu}
        onCreateFolder={() => dispatch({ type: "set-create-folder-open", open: true })}
        onImportOpml={() => setFollowSourcesDialogOpen(true)}
        onOpenArticle={(item) =>
          void routerNavigate({
            params: { article: buildInboxItemSlug(item) },
            search: (prev: InboxSearch) => ({ ...prev, itemId: undefined }),
            to: "/inbox/$article",
          })
        }
        onOpenSource={(feed) =>
          void navigate({
            search: (prev) => ({
              ...prev,
              feedId: feed.feedId,
              filter: "all" as const,
              folderId: undefined,
              itemId: undefined,
              search: undefined,
            }),
          })
        }
        onOpenFeed={(feed) =>
          void navigate({
            search: (prev) => ({
              ...prev,
              feedId: feed.feedId,
              filter: "all" as const,
              folderId: undefined,
              itemId: undefined,
              search: undefined,
            }),
          })
        }
        onSearchArticles={(term) =>
          void navigate({ search: (prev) => ({ ...prev, itemId: undefined, search: term }) })
        }
      />
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <RecapContent
          continueReadingItems={continueReadingItems}
          folders={folders}
          followFeed={(feed, folderId) => followMutation.mutate({ feed, folderId })}
          isFollowingFeed={isFollowingFeed}
          isSummaryEmpty={isSummaryEmpty}
          moveFeed={(feedId, folderId) => moveFeedMutation.mutate({ feedIds: [feedId], folderId })}
          movingFeedId={movingFeedId}
          oldestSavedItems={oldestSavedItems}
          recapError={recapError}
          recapLoading={recapLoading || continueReadingLoading}
          refetchRecap={() => void refetchRecap()}
          topViewedFeeds={topViewedFeeds}
          unsavingItemId={unsavingItemId}
          onCreateFolder={() => dispatch({ type: "set-create-folder-open", open: true })}
          onDismissContinueReading={(itemId) => dismissContinueReadingMutation.mutate({ itemId })}
          onImportOpml={() => setFollowSourcesDialogOpen(true)}
          onManageFolders={() => setMenu({ open: true, page: "folders" })}
          onUnsave={(itemId) => unsaveMutation.mutate({ itemId })}
        />
      </div>

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

/**
 * The desktop-only recap rail beside the inbox feed: one surface holding the search field, the
 * summary and its expanded screens. `show` is driven by measured content width (see
 * `useRecapRailVisibility`), not a raw `xl:` viewport media query, so it agrees with the
 * split/stacked decision made by `useResponsiveReaderMode` and hides itself when the actual
 * content column is cramped even on a wide monitor.
 *
 * It mounts and unmounts (via `AnimatePresence`) instead of toggling a `hidden` class, so crossing
 * that threshold during a resize animates instead of snapping; `initial={false}` keeps it from
 * animating on the page's first render.
 *
 * The search field is centred on the header controls' centreline (their 44px row sits 18px from the
 * top, so 40px; the 40px field starts at 20px), and the rail keeps that same 20px at the bottom.
 */
export function InboxRecap({
  show,
  ...props
}: {
  show: boolean;
  navigate: ReturnType<typeof useInboxRouteState>["navigate"];
}) {
  const prefersReducedMotion = useReducedMotion();
  const transition = springTransition("standard", prefersReducedMotion);

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence initial={false}>
        {show ? (
          <m.aside
            key="recap-rail"
            animate={{ opacity: 1, scale: 1 }}
            className="relative flex h-full w-68 shrink-0 flex-col py-5 2xl:w-76 3xl:w-80"
            exit={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.98 }}
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
            transition={transition}
          >
            <RecapCard {...props} />
          </m.aside>
        ) : null}
      </AnimatePresence>
    </LazyMotion>
  );
}
