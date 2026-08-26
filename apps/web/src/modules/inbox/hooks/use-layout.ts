"use client";

import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMediaQuery } from "@kyomi/ui/hooks/use-media-query";
import type { InboxMarkReadBehaviorDto } from "@kyomi/reader/schemas";
import type { InboxPreferences } from "./use-inbox-data";
import { getInboxItemIdFromSlug } from "../lib/articles/slug";
import type { InboxFilter, InboxSort } from "../lib/articles/index";
import type { InboxRecapRailFolderBackTarget, InboxRecapRailSection } from "../lib/recap/index";

const INBOX_DESKTOP_MIN_WIDTH_PX = 768;
// Matches the `xl` breakpoint the recap rail used to key off of via a raw Tailwind `xl:flex`
// class, now checked against the measured content column instead of raw viewport width.
const INBOX_RECAP_RAIL_MIN_CONTAINER_WIDTH_PX = 1200;

type InboxItemLike = { id: string; isRead: boolean } | null;

export type InboxRouteSearch = {
  filter?: InboxFilter;
  search?: string;
  feedId?: string;
  folderId?: string;
  itemId?: string;
  rail?: InboxRecapRailSection;
  railFolderBack?: InboxRecapRailFolderBackTarget;
  railFolderId?: string;
  showHidden?: "1";
  showRead?: "1";
  sort?: InboxSort;
};

type InboxRouteNavigateOptions = {
  search: (prev: InboxRouteSearch) => InboxRouteSearch;
  replace?: boolean;
};

export type InboxLayoutVariant = "split" | "stacked";

function parseSearchFlag(value: string | undefined) {
  if (!value) {
    return false;
  }
  const normalized = value.replaceAll('"', "");
  return normalized === "1" || normalized === "true";
}

/**
 * Inbox main-column layout by available content width:
 * - wide: split (list view, desktop)
 * - narrow: stacked (single column list <-> detail, mobile)
 */
export function useResponsiveReaderMode(contentWidthPx?: number): InboxLayoutVariant {
  const isWideViewport = useMediaQuery({ min: "md", defaultMatches: true });

  if (contentWidthPx && contentWidthPx > 0) {
    if (contentWidthPx >= INBOX_DESKTOP_MIN_WIDTH_PX) {
      return "split";
    }
    return "stacked";
  }

  if (isWideViewport) {
    return "split";
  }
  return "stacked";
}

/**
 * Whether the inbox recap rail has enough *measured* content width to show, not just a wide
 * window (a maximized-but-narrow split-screen window can be `xl`+ wide while the actual content
 * column is cramped). `defaultMatches: true` keeps the SSR-rendered default the same as the
 * rail's old behavior (visible at `xl`+) so there's no hydration flash; `contentWidthPx` only
 * ever narrows that down further, once a real measurement exists.
 */
export function useRecapRailVisibility(contentWidthPx: number): boolean {
  const isViewportWideEnough = useMediaQuery({ min: "xl", defaultMatches: true });
  const isTooTight = contentWidthPx > 0 && contentWidthPx < INBOX_RECAP_RAIL_MIN_CONTAINER_WIDTH_PX;

  return isViewportWideEnough && !isTooTight;
}

export function useInboxRouteState(preferences: InboxPreferences) {
  const {
    filter,
    search,
    feedId,
    folderId,
    itemId,
    rail,
    railFolderBack,
    railFolderId,
    showHidden,
    showRead,
    sort,
  } = useSearch({ strict: false });
  const params = useParams({ strict: false });
  const rawNavigate = useNavigate();
  const article = typeof params?.article === "string" ? params.article : undefined;
  const slugItemId = getInboxItemIdFromSlug(article);
  const routeItemId = itemId ?? slugItemId;
  const navigate = useCallback(
    ({ search: updateSearch, replace }: InboxRouteNavigateOptions) => {
      const previousSearch: InboxRouteSearch = {
        filter,
        search,
        feedId,
        folderId,
        itemId,
        rail,
        railFolderBack,
        railFolderId,
        showHidden,
        showRead,
        sort,
      };
      const nextSearch = updateSearch(previousSearch);

      if (article) {
        return rawNavigate({
          to: "/inbox/$article",
          params: { article },
          search: nextSearch,
          replace,
        });
      }

      return rawNavigate({
        to: "/inbox",
        search: nextSearch,
        replace,
      });
    },
    [
      article,
      feedId,
      filter,
      folderId,
      itemId,
      rail,
      railFolderBack,
      railFolderId,
      rawNavigate,
      search,
      showHidden,
      showRead,
      sort,
    ],
  );

  const showHiddenItems = parseSearchFlag(showHidden);
  const showReadItems = parseSearchFlag(showRead);
  const effectiveFilter = (filter ?? preferences.inboxDefaultView) as InboxFilter;
  const supportsReadScopedFilters = false;
  const isReadScopedFilterActive = supportsReadScopedFilters && (showHiddenItems || showReadItems);
  const includeRead = isReadScopedFilterActive;

  useEffect(() => {
    if (filter !== undefined) {
      return;
    }
    void navigate({
      search: (prev) => ({
        ...prev,
        filter: preferences.inboxDefaultView,
      }),
      replace: true,
    });
  }, [filter, navigate, preferences.inboxDefaultView]);

  useEffect(() => {
    if (supportsReadScopedFilters || (!showHiddenItems && !showReadItems)) {
      return;
    }
    void navigate({
      search: (prev) => ({
        ...prev,
        showHidden: undefined,
        showRead: undefined,
      }),
      replace: true,
    });
  }, [navigate, showHiddenItems, showReadItems, supportsReadScopedFilters]);

  return useMemo(
    () => ({
      navigate,
      filter,
      search,
      feedId,
      folderId,
      itemId: routeItemId,
      rail,
      railFolderBack,
      railFolderId,
      effectiveFilter,
      isReadScopedFilterActive,
      includeRead,
      sort,
    }),
    [
      navigate,
      filter,
      search,
      feedId,
      folderId,
      routeItemId,
      rail,
      railFolderBack,
      railFolderId,
      effectiveFilter,
      isReadScopedFilterActive,
      includeRead,
      sort,
    ],
  );
}

/**
 * Marks the open item read for non-recent views according to inbox preference, with a
 * cancellable delay for the "after-delay" mode.
 */
export function useMarkReadBehavior(input: {
  itemId: string | undefined;
  selectedItem: InboxItemLike;
  effectiveFilter: InboxFilter;
  markReadBehavior: InboxMarkReadBehaviorDto;
  onMarkRead: (itemId: string) => void;
}) {
  const timeoutRef = useRef<number | null>(null);
  const onMarkReadRef = useRef(input.onMarkRead);

  useEffect(() => {
    onMarkReadRef.current = input.onMarkRead;
  }, [input.onMarkRead]);

  useEffect(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const { itemId, selectedItem, effectiveFilter, markReadBehavior } = input;
    const selectedItemIsRead = selectedItem?.isRead ?? false;

    if (
      !itemId ||
      !selectedItem ||
      selectedItem.id !== itemId ||
      selectedItemIsRead ||
      effectiveFilter === "recent" ||
      markReadBehavior === "manual"
    ) {
      return;
    }

    if (markReadBehavior === "on-open") {
      onMarkReadRef.current(itemId);
      return;
    }

    if (markReadBehavior === "after-delay") {
      timeoutRef.current = window.setTimeout(() => {
        onMarkReadRef.current(itemId);
        timeoutRef.current = null;
      }, 1500);

      return () => {
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };
    }
  }, [
    input.effectiveFilter,
    input.itemId,
    input.markReadBehavior,
    input.selectedItem?.isRead,
    input.selectedItem?.id,
  ]);
}
