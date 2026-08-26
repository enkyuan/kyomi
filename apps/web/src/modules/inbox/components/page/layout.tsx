"use client";

import { useMemo } from "react";
import type { RefObject } from "react";
import type { useRouter } from "@tanstack/react-router";
import type { TransitionProps } from "@kyomi/ui/transition";
import type { ArticleDetailDto } from "@kyomi/reader/schemas";
import type { InboxPreferences } from "@modules/inbox/hooks/use-inbox-data";
import type { useInboxRouteState, useResponsiveReaderMode } from "@modules/inbox/hooks/use-layout";
import type { InboxItem } from "@modules/inbox/lib/articles/index";
import type { ArticleStepDirection } from "@modules/reader/lib/detail";
import type { Folder } from "@modules/folders/lib/api";
import { MobileLayout } from "@modules/inbox/layouts/mobile";
import { Recap } from "@modules/inbox/components/page/recap";
import { ArticleShell } from "@modules/inbox/components/page/article/shell";
import { DetailSection } from "@modules/inbox/components/page/detail";
import { Feed } from "@modules/inbox/components/page/feed";
import { ListSection } from "@modules/inbox/components/page/list";

export function InboxPageLayout({
  detail,
  layout,
  list,
  navigation,
  page,
  recap,
}: {
  detail: {
    detailError: unknown;
    isDetailError: boolean;
    isDetailFetching: boolean;
    selectedItem: ArticleDetailDto | null;
  };
  layout: {
    layoutContainerRef: RefObject<HTMLDivElement | null>;
    layoutVariant: ReturnType<typeof useResponsiveReaderMode>;
    mobileTransitionDirection: 1 | -1;
    showDetail: boolean;
  };
  list: {
    activeFeedLabel: string | undefined;
    effectiveFilter: ReturnType<typeof useInboxRouteState>["effectiveFilter"];
    feedId: string | undefined;
    fetchNextInboxPage: () => void;
    folderId: string | undefined;
    hasKnownEmptyFeedBackedView: boolean;
    hasNextInboxPage: boolean | undefined;
    inboxDataUpdatedAt: number;
    inboxItems: InboxItem[];
    isInboxFetching: boolean;
    isInboxFetchingNextPage: boolean;
    isInboxPending: boolean;
    itemId: string | undefined;
    navigate: ReturnType<typeof useInboxRouteState>["navigate"];
    pinnedFolders: Folder[];
    preferences: InboxPreferences;
    prefetchItem: (item: InboxItem) => void;
    router: ReturnType<typeof useRouter>;
    selectItem: (item: InboxItem, direction?: ArticleStepDirection) => void;
    sort: ReturnType<typeof useInboxRouteState>["sort"];
    clearSelectedItem: () => void;
  };
  navigation: {
    articleStepDirection: ArticleStepDirection;
    canSelectNextItem: boolean;
    canSelectPreviousItem: boolean;
    clearSelectedItem: () => void;
    selectAdjacentItem: (offset: -1 | 1) => void;
  };
  page: {
    feedTransition: Omit<TransitionProps, "children">;
  };
  recap: {
    navigate: ReturnType<typeof useInboxRouteState>["navigate"];
    rail: ReturnType<typeof useInboxRouteState>["rail"];
    railFolderBack: ReturnType<typeof useInboxRouteState>["railFolderBack"];
    railFolderId: string | undefined;
    showRecap: boolean;
  };
}) {
  const listElement = (
    <ListSection
      effectiveFilter={list.effectiveFilter}
      feedId={list.feedId}
      feedLabel={list.activeFeedLabel}
      folderId={list.folderId}
      itemId={list.itemId}
      pinnedFolders={list.pinnedFolders}
      preferences={list.preferences}
      inboxItems={list.inboxItems}
      hasKnownEmptyFeedBackedView={list.hasKnownEmptyFeedBackedView}
      hasNextInboxPage={list.hasNextInboxPage}
      inboxDataUpdatedAt={list.inboxDataUpdatedAt}
      isInboxFetching={list.isInboxFetching}
      isInboxFetchingNextPage={list.isInboxFetchingNextPage}
      isInboxPending={list.isInboxPending}
      showScrollbar={!layout.showDetail}
      fetchNextInboxPage={list.fetchNextInboxPage}
      selectItem={list.selectItem}
      prefetchItem={list.prefetchItem}
      navigate={list.navigate}
      router={list.router}
      sort={list.sort}
      selectedItem={detail.selectedItem}
      clearSelectedItem={list.clearSelectedItem}
    />
  );

  const detailElementWithBack = useMemo(
    () => (
      <DetailSection
        preferences={list.preferences}
        detailError={detail.detailError}
        isDetailError={detail.isDetailError}
        isDetailFetching={detail.isDetailFetching}
        selectedItem={detail.selectedItem}
        showBackToList
        surface="card"
        clearSelectedItem={navigation.clearSelectedItem}
      />
    ),
    [
      detail.detailError,
      detail.isDetailError,
      detail.isDetailFetching,
      detail.selectedItem,
      list.preferences,
      navigation.clearSelectedItem,
    ],
  );

  const feedDetailElement = useMemo(
    () => (
      <ArticleShell
        preferences={list.preferences}
        detailError={detail.detailError}
        isDetailError={detail.isDetailError}
        isDetailFetching={detail.isDetailFetching}
        selectedItem={detail.selectedItem}
        onBackToList={navigation.clearSelectedItem}
        onSelectPreviousItem={() => navigation.selectAdjacentItem(-1)}
        onSelectNextItem={() => navigation.selectAdjacentItem(1)}
        canSelectPreviousItem={navigation.canSelectPreviousItem}
        canSelectNextItem={navigation.canSelectNextItem}
        articleStepDirection={navigation.articleStepDirection}
      />
    ),
    [
      detail.detailError,
      detail.isDetailError,
      detail.isDetailFetching,
      detail.selectedItem,
      list.preferences,
      navigation,
    ],
  );

  return (
    <div ref={layout.layoutContainerRef} className="h-full max-h-full min-h-0 min-w-0">
      {layout.layoutVariant === "stacked" ? (
        <MobileLayout
          showDetail={Boolean(list.itemId)}
          direction={layout.mobileTransitionDirection}
          list={listElement}
          detail={detailElementWithBack}
        />
      ) : (
        <div className="flex h-full max-h-full min-h-0 min-w-0 gap-0 overflow-hidden">
          <Feed
            detail={feedDetailElement}
            list={listElement}
            showDetail={layout.showDetail}
            transition={page.feedTransition}
          />
          <Recap
            show={recap.showRecap}
            navigate={recap.navigate}
            rail={recap.rail}
            railFolderBack={recap.railFolderBack}
            railFolderId={recap.railFolderId}
          />
        </div>
      )}
    </div>
  );
}
