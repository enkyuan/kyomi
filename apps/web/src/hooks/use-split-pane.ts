"use client";

import { useEffect, useRef, useState } from "react";
import { writeInboxSplitPanePercentCookie } from "@modules/inbox/lib/layout-persistence";

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

export function useSplitPane({
  minLeftPercent = 24,
  minRightPercent = 60,
  initialPercent = 32,
} = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [leftPanelPercent, setLeftPanelPercent] = useState(() =>
    clampSplitPanePercent(initialPercent, minLeftPercent, minRightPercent),
  );
  const [isResizing, setIsResizing] = useState(false);
  const dragPercentRef = useRef(leftPanelPercent);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isResizing) {
      dragPercentRef.current = leftPanelPercent;
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

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      const next = ((event.clientX - rect.left) / rect.width) * 100;
      const clamped = clampSplitPanePercent(next, minLeftPercent, minRightPercent);
      dragPercentRef.current = clamped;

      if (rafIdRef.current !== null) {
        return;
      }

      rafIdRef.current = window.requestAnimationFrame(() => {
        rafIdRef.current = null;
        writeSplitPanePercentToContainer(containerRef.current, dragPercentRef.current);
      });
    };

    const handlePointerUp = () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      writeSplitPanePercentToContainer(containerRef.current, dragPercentRef.current);
      setLeftPanelPercent(dragPercentRef.current);
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      writeInboxSplitPanePercentCookie(dragPercentRef.current);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isResizing, minLeftPercent, minRightPercent]);

  return {
    containerRef,
    leftPanelPercent,
    isResizing,
    setIsResizing,
  };
}
