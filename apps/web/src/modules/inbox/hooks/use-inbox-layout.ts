"use client";

import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useReducer, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useMediaQuery } from "@hooks/use-media-query";
import type { InboxMarkReadBehaviorDto } from "@lib/schemas";
import { writeInboxSplitPanePercentCookie } from "../lib/layout-persistence";
import type { InboxFilter } from "../services/api";
import type { InboxPreferences } from "./use-inbox-data";

const SPLIT_PANE_PERCENT_CSS_VAR = "--inbox-left-panel-percent";
const INBOX_SPLIT_MIN_WIDTH_PX = 1024;
const INBOX_READER_FOCUS_MIN_WIDTH_PX = 800;

type InboxItemLike = { id: string; isRead: boolean } | null;

type SplitPaneState = {
  leftPanelPercent: number;
  isResizing: boolean;
};

type SplitPaneAction =
  | { type: "sync_percent"; percent: number }
  | { type: "start_resize" }
  | { type: "end_resize"; percent: number };

export type InboxLayoutVariant = "split" | "reader-focused" | "stacked";

export type ResizeHandleProps = {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

function parseSearchFlag(value: string | undefined) {
  if (!value) {
    return false;
  }
  const normalized = value.replaceAll('"', "");
  return normalized === "1" || normalized === "true";
}

function clampSplitPanePercent(value: number, minLeftPercent: number, minRightPercent: number) {
  const maxLeft = 100 - minRightPercent;
  return Math.min(maxLeft, Math.max(minLeftPercent, value));
}

function writeSplitPanePercentToContainer(container: HTMLDivElement | null, value: number) {
  if (!container) {
    return;
  }
  container.style.setProperty(SPLIT_PANE_PERCENT_CSS_VAR, `${value.toFixed(3)}%`);
}

function setBodyResizeStyles(enabled: boolean) {
  Object.assign(document.body.style, {
    cursor: enabled ? "col-resize" : "",
    userSelect: enabled ? "none" : "",
  });
}

function splitPaneReducer(state: SplitPaneState, action: SplitPaneAction): SplitPaneState {
  switch (action.type) {
    case "sync_percent":
      return { ...state, leftPanelPercent: action.percent };
    case "start_resize":
      return { ...state, isResizing: true };
    case "end_resize":
      return { leftPanelPercent: action.percent, isResizing: false };
    default:
      return state;
  }
}

/**
 * Inbox main-column layout by available content width:
 * - wide: split (list + detail)
 * - tablet-width landscape: reader-focused (detail fills main; auto-select first item)
 * - narrow: stacked (single column list <-> detail, same as mobile)
 */
export function useResponsiveReaderMode(contentWidthPx?: number): InboxLayoutVariant {
  const isWideViewport = useMediaQuery({ min: "lg", defaultMatches: true });
  const isLandscape = useMediaQuery({ orientation: "landscape" });
  const isTabletRange = useMediaQuery({ min: "md", max: "lg" });

  if (contentWidthPx && contentWidthPx > 0) {
    if (contentWidthPx >= INBOX_SPLIT_MIN_WIDTH_PX) {
      return "split";
    }
    if (contentWidthPx >= INBOX_READER_FOCUS_MIN_WIDTH_PX && isLandscape) {
      return "reader-focused";
    }
    return "stacked";
  }

  // Desktop defaults to split regardless of orientation.
  if (isWideViewport) {
    return "split";
  }
  if (isTabletRange && isLandscape) {
    return "reader-focused";
  }
  return "stacked";
}

export function useInboxRouteState(preferences: InboxPreferences) {
  const { filter, search, feedId, folderId, itemId, showHidden, showRead } = useSearch({
    from: "/inbox/",
  });
  const navigate = useNavigate({ from: "/inbox/" });

  const showHiddenItems = parseSearchFlag(showHidden);
  const showReadItems = parseSearchFlag(showRead);
  const effectiveFilter = (filter ?? preferences.inboxDefaultView) as InboxFilter;
  const supportsReadScopedFilters = effectiveFilter === "today";
  const isReadScopedFilterActive = supportsReadScopedFilters && (showHiddenItems || showReadItems);
  const includeRead = isReadScopedFilterActive;

  const activeScopeLabel = isReadScopedFilterActive
    ? showHiddenItems && !showReadItems
      ? "hidden"
      : "read"
    : undefined;

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
      itemId,
      showHiddenItems,
      showReadItems,
      effectiveFilter,
      supportsReadScopedFilters,
      isReadScopedFilterActive,
      includeRead,
      activeScopeLabel,
    }),
    [
      navigate,
      filter,
      search,
      feedId,
      folderId,
      itemId,
      showHiddenItems,
      showReadItems,
      effectiveFilter,
      supportsReadScopedFilters,
      isReadScopedFilterActive,
      includeRead,
      activeScopeLabel,
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
  onMarkReadRef.current = input.onMarkRead;

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

export function useSplitPane({
  minLeftPercent = 24,
  minRightPercent = 60,
  initialPercent = 32,
} = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [{ leftPanelPercent, isResizing }, dispatch] = useReducer(
    splitPaneReducer,
    initialPercent,
    (percent) => ({
      leftPanelPercent: clampSplitPanePercent(percent, minLeftPercent, minRightPercent),
      isResizing: false,
    }),
  );
  const dragPercentRef = useRef(leftPanelPercent);
  const rafIdRef = useRef<number | null>(null);
  const isResizingRef = useRef(isResizing);
  const boundsRef = useRef({ minLeftPercent, minRightPercent });

  isResizingRef.current = isResizing;
  boundsRef.current = { minLeftPercent, minRightPercent };
  dragPercentRef.current = leftPanelPercent;

  useEffect(() => {
    writeSplitPanePercentToContainer(containerRef.current, initialPercent);
  }, [initialPercent]);

  useEffect(() => {
    return () => {
      const rafId = rafIdRef.current;
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Stable — all mutable state accessed via refs; no state deps.
  const resizeHandleProps = useMemo((): ResizeHandleProps => {
    const finishResize = (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isResizingRef.current) {
        return;
      }
      event.currentTarget.releasePointerCapture(event.pointerId);

      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      const { minLeftPercent: minLeft, minRightPercent: minRight } = boundsRef.current;
      const percent = clampSplitPanePercent(dragPercentRef.current, minLeft, minRight);
      writeSplitPanePercentToContainer(containerRef.current, percent);
      isResizingRef.current = false;
      dispatch({ type: "end_resize", percent });
      setBodyResizeStyles(false);
      writeInboxSplitPanePercentCookie(percent);
    };

    return {
      onPointerDown: (event) => {
        if (isResizingRef.current) {
          return;
        }
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        isResizingRef.current = true;
        dispatch({ type: "start_resize" });
        setBodyResizeStyles(true);
      },

      onPointerMove: (event) => {
        if (!isResizingRef.current) {
          return;
        }
        const container = containerRef.current;
        if (!container) {
          return;
        }
        const rect = container.getBoundingClientRect();
        if (rect.width <= 0) {
          return;
        }

        const { minLeftPercent: minLeft, minRightPercent: minRight } = boundsRef.current;
        const next = ((event.clientX - rect.left) / rect.width) * 100;
        dragPercentRef.current = clampSplitPanePercent(next, minLeft, minRight);

        if (rafIdRef.current !== null) {
          return;
        }
        rafIdRef.current = window.requestAnimationFrame(() => {
          rafIdRef.current = null;
          writeSplitPanePercentToContainer(containerRef.current, dragPercentRef.current);
        });
      },

      onPointerUp: finishResize,
      onPointerCancel: finishResize,
    };
  }, []);

  return {
    containerRef,
    leftPanelPercent,
    isResizing,
    resizeHandleProps,
  };
}
