"use client";

import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@kyomi/ui/hooks/use-media-query";

export function useFloatingToolbar({
  itemId,
  readerFocusMode,
}: {
  itemId: string;
  readerFocusMode: boolean;
}) {
  const isMobile = useMediaQuery({ max: "md" });
  const inlineToolbarRef = useRef<HTMLDivElement | null>(null);
  const [desktopFloatingToolbarVisible, setDesktopFloatingToolbarVisible] = useState(false);

  useEffect(() => {
    if (isMobile) {
      return;
    }

    const inlineToolbarNode = inlineToolbarRef.current;
    if (!inlineToolbarNode || typeof window === "undefined") {
      return;
    }

    const viewport = inlineToolbarNode.closest<HTMLElement>("[data-reader-detail-viewport]");
    if (!viewport || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setDesktopFloatingToolbarVisible(isFloatingToolbarVisibleForEntry(entry));
      },
      {
        root: viewport,
        rootMargin: "0px",
        threshold: 0,
      },
    );

    // oxlint-disable-next-line react-doctor/no-adjust-state-on-prop-change
    observer.observe(inlineToolbarNode);

    return () => {
      observer.disconnect();
    };
  }, [isMobile, itemId, readerFocusMode]);

  return {
    floatingToolbarEdge: isMobile ? "bottom" : "top",
    inlineToolbarRef,
    showFloatingToolbar: isMobile || desktopFloatingToolbarVisible,
  } as const;
}

function isFloatingToolbarVisibleForEntry(entry: IntersectionObserverEntry) {
  if (entry.isIntersecting) {
    return false;
  }

  const rootTop = entry.rootBounds?.top ?? 0;
  const isRendered = entry.boundingClientRect.height > 0;
  const isScrolledPast = entry.boundingClientRect.bottom <= rootTop;

  return isRendered && isScrolledPast;
}
