"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import {
  InboxPreferencesBootstrapProvider,
  type InboxPreferences,
  dedupePagedInboxItemsById,
  useInboxItemStateMutation,
  useInboxPreferences,
  useInboxQueries,
} from "@modules/inbox/hooks/use-inbox-data";
import {
  useInboxRouteState,
  useRecapRailVisibility,
  useResponsiveReaderMode,
} from "@modules/inbox/hooks/use-layout";
import { useTimezone } from "@hooks/use-timezone";
import { useTransition } from "@hooks/use-transition";
import { useViewport } from "@hooks/use-viewport";
import { QUERY_TIMES } from "@lib/query/policies";
import { writeShellStateSnapshot } from "@lib/shell/state";
import { listFollowedFeeds } from "@modules/feeds/lib/api";
import { listFolders } from "@modules/folders/lib/api";
import {
  followedFeedsQueryKey,
  getFeedRefreshPollInterval,
  prefetchInboxSegmentedControlTarget,
} from "@modules/inbox/queries/options";
import { FEED_TRANSITION_OFFSET } from "@modules/inbox/lib/layout";
import type { ArticleStepDirection } from "@modules/reader/lib/detail";
import { usePolling } from "./hooks/use-polling";
import { InboxPageLayout } from "./components/page/layout";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInboxSelectionNavigation } from "./hooks/use-selection-navigation";

type InboxPageProps = {
  initialInboxPreferences?: InboxPreferences;
  initialTimezoneOffsetMinutes?: number;
};

export function Page({ initialInboxPreferences, initialTimezoneOffsetMinutes }: InboxPageProps) {
  return (
    <InboxPreferencesBootstrapProvider initialPreferences={initialInboxPreferences}>
      <InboxPageContent
        initialInboxPreferences={initialInboxPreferences}
        initialTimezoneOffsetMinutes={initialTimezoneOffsetMinutes}
      />
    </InboxPreferencesBootstrapProvider>
  );
}

function InboxPageContent({
  initialInboxPreferences,
  initialTimezoneOffsetMinutes,
}: InboxPageProps) {
  const { preferences } = useInboxPreferences(initialInboxPreferences);
  const router = useRouter();
  const queryClient = useQueryClient();
  const layoutContainerRef = useRef<HTMLDivElement | null>(null);
  const { containerWidth: layoutContainerWidth } = useViewport(layoutContainerRef);
  const layoutVariant = useResponsiveReaderMode(layoutContainerWidth);
  const showRecap = useRecapRailVisibility(layoutContainerWidth);
  const [mobileTransitionDirection, setMobileTransitionDirection] = useState<1 | -1>(1);
  const [articleStepDirection, setArticleStepDirection] = useState<ArticleStepDirection>(1);
  const clientTimezoneOffsetMinutes = useTimezone();
  const timezoneOffsetMinutes = clientTimezoneOffsetMinutes ?? initialTimezoneOffsetMinutes;

  const route = useInboxRouteState(preferences);
  const {
    navigate,
    search,
    feedId,
    folderId,
    itemId,
    rail,
    railFolderBack,
    railFolderId,
    effectiveFilter,
    isReadScopedFilterActive,
    includeRead,
    sort,
  } = route;

  const {
    detailData,
    detailError,
    fetchNextInboxPage: requestNextInboxPage,
    hasNextInboxPage,
    inboxData,
    inboxDataUpdatedAt,
    isDetailError,
    isDetailFetching,
    isInboxFetching,
    isInboxFetchingNextPage,
    isInboxPending,
  } = useInboxQueries({
    filter: effectiveFilter,
    search,
    feedId,
    folderId,
    itemId,
    includeRead,
    sort,
    timezoneOffsetMinutes,
  });
  const { isSuccess: isFollowedFeedsSuccess, data: followedFeedsData } = useQuery({
    queryKey: followedFeedsQueryKey(),
    queryFn: () => listFollowedFeeds(),
    staleTime: QUERY_TIMES.staticMetadataStale,
    gcTime: QUERY_TIMES.staticMetadataGc,
    refetchInterval: (query) =>
      getFeedRefreshPollInterval(
        query.state.data as Awaited<ReturnType<typeof listFollowedFeeds>> | undefined,
      ),
    refetchIntervalInBackground: false,
  });
  const { data: foldersData } = useQuery({
    queryKey: ["folders"],
    queryFn: () => listFolders(),
    staleTime: QUERY_TIMES.staticMetadataStale,
    gcTime: QUERY_TIMES.staticMetadataGc,
  });
  usePolling(followedFeedsData);
  const hasNoFollowedFeeds = isFollowedFeedsSuccess && (followedFeedsData?.length ?? 0) === 0;
  const pinnedFolders = useMemo(
    () =>
      (foldersData ?? [])
        .filter((folder) => folder.isPinned)
        .sort((left, right) => {
          const leftTime = left.pinnedAt ? new Date(left.pinnedAt).getTime() : 0;
          const rightTime = right.pinnedAt ? new Date(right.pinnedAt).getTime() : 0;
          if (leftTime !== rightTime) {
            return rightTime - leftTime;
          }
          return left.name.localeCompare(right.name);
        }),
    [foldersData],
  );
  useEffect(() => {
    if (timezoneOffsetMinutes === undefined) {
      return;
    }

    void prefetchInboxSegmentedControlTarget(queryClient, {
      filter: effectiveFilter,
      search,
      feedId,
      folderId,
      includeRead,
      sort,
      timezoneOffsetMinutes,
    }).catch(() => undefined);
  }, [
    effectiveFilter,
    feedId,
    folderId,
    includeRead,
    queryClient,
    search,
    sort,
    timezoneOffsetMinutes,
  ]);
  const activeFeedLabel = useMemo(() => {
    if (!feedId) {
      return undefined;
    }
    const activeFeed = followedFeedsData?.find((feed) => feed.feedId === feedId);
    return activeFeed?.title || activeFeed?.url;
  }, [feedId, followedFeedsData]);
  const isFeedBackedListView =
    !search &&
    !feedId &&
    !folderId &&
    effectiveFilter !== "my-feed" &&
    effectiveFilter !== "all" &&
    effectiveFilter !== "saved" &&
    effectiveFilter !== "recent";
  const hasKnownEmptyFeedBackedView = hasNoFollowedFeeds && isFeedBackedListView;

  const rawInboxItems = useMemo(
    () => dedupePagedInboxItemsById(inboxData?.pages),
    [inboxData?.pages],
  );

  const inboxItems = useMemo(() => {
    if (isReadScopedFilterActive) {
      return rawInboxItems.filter((item) => item.isRead);
    }
    return rawInboxItems;
  }, [isReadScopedFilterActive, rawInboxItems]);

  const selectedItem = detailData?.item ?? null;
  const showDetail = Boolean(itemId);
  const feedTransition = useTransition({
    className: "absolute inset-0",
    contentKey: showDetail ? "feed-article" : "feed-list",
    direction: showDetail ? "forward" : "backward",
    features: "max",
    layoutGroupId: "inbox-feed",
    mode: "sync",
    offset: FEED_TRANSITION_OFFSET,
  });
  const { mutate: updateInboxItemState } = useInboxItemStateMutation();
  const markItemRead = useCallback(
    (nextItemId: string) => {
      updateInboxItemState({
        itemId: nextItemId,
        patch: { isRead: true },
      });
    },
    [updateInboxItemState],
  );

  const {
    canSelectNextItem,
    canSelectPreviousItem,
    clearSelectedItem,
    fetchNextInboxPage,
    prefetchItem,
    selectAdjacentItem,
    selectItem,
  } = useInboxSelectionNavigation({
    effectiveFilter,
    inboxItems,
    itemId,
    markReadBehavior: preferences.inboxMarkReadBehavior,
    onMarkRead: markItemRead,
    queryClient,
    requestNextInboxPage,
    router,
    selectedItem,
    setArticleStepDirection,
    setMobileTransitionDirection,
  });

  useEffect(() => {
    writeShellStateSnapshot({
      inboxFilter: effectiveFilter,
      inboxLayout: layoutVariant,
      selectedItemId: itemId ?? null,
    });
  }, [effectiveFilter, itemId, layoutVariant]);

  return (
    <InboxPageLayout
      detail={{
        detailError,
        isDetailError,
        isDetailFetching,
        selectedItem,
      }}
      layout={{
        layoutContainerRef,
        layoutVariant,
        mobileTransitionDirection,
        showDetail,
      }}
      list={{
        activeFeedLabel,
        effectiveFilter,
        feedId,
        fetchNextInboxPage,
        folderId,
        hasKnownEmptyFeedBackedView,
        hasNextInboxPage,
        inboxDataUpdatedAt,
        inboxItems,
        isInboxFetching,
        isInboxFetchingNextPage,
        isInboxPending,
        itemId,
        navigate,
        pinnedFolders,
        preferences,
        prefetchItem,
        router,
        selectItem,
        sort,
        clearSelectedItem,
      }}
      navigation={{
        articleStepDirection,
        canSelectNextItem,
        canSelectPreviousItem,
        clearSelectedItem,
        selectAdjacentItem,
      }}
      page={{
        feedTransition,
      }}
      recap={{
        navigate,
        rail,
        railFolderBack,
        railFolderId,
        showRecap,
      }}
    />
  );
}
