"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { writeInboxSplitPanePercentCookie } from "../lib/layout-persistence";

const SPLIT_PANE_PERCENT_CSS_VAR = "--inbox-left-panel-percent";

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

type SplitPaneState = {
  leftPanelPercent: number;
  isResizing: boolean;
};

type SplitPaneAction =
  | { type: "sync_percent"; percent: number }
  | { type: "start_resize" }
  | { type: "end_resize"; percent: number };

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

export type ResizeHandleProps = {
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

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
    if (!isResizing) {
      writeSplitPanePercentToContainer(containerRef.current, leftPanelPercent);
    }
  }, [isResizing, leftPanelPercent]);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    containerRef,
    leftPanelPercent,
    isResizing,
    resizeHandleProps,
  };
}
