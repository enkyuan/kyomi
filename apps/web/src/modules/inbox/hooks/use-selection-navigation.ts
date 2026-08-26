"use client";

import { useCallback, useMemo } from "react";
import type { useRouter } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import type { ArticleDetailDto, InboxMarkReadBehaviorDto } from "@kyomi/reader/schemas";
import type { ArticleStepDirection } from "@modules/reader/lib/detail";
import type { InboxItem } from "@modules/inbox/lib/articles/index";
import type { InboxRouteSearch, useInboxRouteState } from "@modules/inbox/hooks/use-layout";
import { useMarkReadBehavior } from "@modules/inbox/hooks/use-layout";
import { useRecordInboxItemView } from "@modules/inbox/hooks/use-inbox-data";
import { buildInboxItemSlug } from "@modules/inbox/lib/articles/slug";
import { prefetchInboxItemDetail } from "@modules/inbox/queries/options";

export function useInboxSelectionNavigation({
  effectiveFilter,
  inboxItems,
  itemId,
  markReadBehavior,
  onMarkRead,
  queryClient,
  requestNextInboxPage,
  router,
  selectedItem,
  setArticleStepDirection,
  setMobileTransitionDirection,
}: {
  effectiveFilter: ReturnType<typeof useInboxRouteState>["effectiveFilter"];
  inboxItems: InboxItem[];
  itemId: string | undefined;
  markReadBehavior: InboxMarkReadBehaviorDto;
  onMarkRead: (itemId: string) => void;
  queryClient: QueryClient;
  requestNextInboxPage: () => void;
  router: ReturnType<typeof useRouter>;
  selectedItem: ArticleDetailDto | null;
  setArticleStepDirection: (direction: ArticleStepDirection) => void;
  setMobileTransitionDirection: (direction: 1 | -1) => void;
}) {
  useRecordInboxItemView(itemId);
  useMarkReadBehavior({
    itemId,
    selectedItem,
    effectiveFilter,
    markReadBehavior,
    onMarkRead,
  });

  const selectedItemIndex = useMemo(() => {
    if (!selectedItem) {
      return -1;
    }
    return inboxItems.findIndex((item) => item.id === selectedItem.id);
  }, [inboxItems, selectedItem]);

  const clearSelectedItem = useCallback(() => {
    setMobileTransitionDirection(-1);
    void router.navigate({
      to: "/inbox",
      search: (prev: InboxRouteSearch) => ({
        ...prev,
        itemId: undefined,
      }),
    });
  }, [router, setMobileTransitionDirection]);

  const selectItem = useCallback(
    (item: InboxItem, direction: ArticleStepDirection = 1) => {
      setMobileTransitionDirection(1);
      setArticleStepDirection(direction);
      void router.navigate({
        to: "/inbox/$article",
        params: {
          article: buildInboxItemSlug(item),
        },
        search: (prev: InboxRouteSearch) => ({
          ...prev,
          itemId: undefined,
        }),
      });
    },
    [router, setArticleStepDirection, setMobileTransitionDirection],
  );

  const selectAdjacentItem = useCallback(
    (offset: -1 | 1) => {
      if (selectedItemIndex < 0) {
        return;
      }
      const nextItem = inboxItems[selectedItemIndex + offset];
      if (!nextItem) {
        return;
      }
      selectItem(nextItem, offset);
    },
    [inboxItems, selectItem, selectedItemIndex],
  );

  const fetchNextInboxPage = useCallback(() => {
    void requestNextInboxPage();
  }, [requestNextInboxPage]);

  const prefetchItem = useCallback(
    (item: InboxItem) => {
      void prefetchInboxItemDetail(queryClient, item.id).catch(() => undefined);
    },
    [queryClient],
  );

  return {
    canSelectNextItem: selectedItemIndex >= 0 && selectedItemIndex < inboxItems.length - 1,
    canSelectPreviousItem: selectedItemIndex > 0,
    clearSelectedItem,
    fetchNextInboxPage,
    prefetchItem,
    selectAdjacentItem,
    selectItem,
  };
}
