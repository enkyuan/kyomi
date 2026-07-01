"use client";

import { useEffect, useState, type RefObject } from "react";

type ScrollbarRect = { top: number; height: number };

export function useFixedScrollbarRect(
  rootRef: RefObject<HTMLElement | null>,
): ScrollbarRect | null {
  // oxlint-disable-next-line react-doctor/no-initialize-state -- effect continuously syncs on resize/scroll, not just at mount
  const [rect, setRect] = useState<ScrollbarRect | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") {
      return;
    }
    const update = () => {
      const next = root.getBoundingClientRect();
      setRect((prev) =>
        prev && prev.top === next.top && prev.height === next.height
          ? prev
          : { top: next.top, height: next.height },
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [rootRef]);

  return rect;
}
