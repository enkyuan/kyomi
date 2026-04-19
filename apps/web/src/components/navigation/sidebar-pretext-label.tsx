"use client";

import { layout, prepare } from "@chenglou/pretext";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@lib/utils";

const SIDEBAR_LABEL_FONT = '400 14px "Inter Variable"';
const SIDEBAR_LABEL_LINE_HEIGHT = 20;

/** `prepare()` uses canvas text measurement — not available during SSR (Node). */
function prepareLabelForLayout(label: string, font: string) {
  if (import.meta.env.SSR) {
    return null;
  }
  return prepare(label, font);
}

export function SidebarPretextLabel({
  className,
  font = SIDEBAR_LABEL_FONT,
  label,
  lineHeight = SIDEBAR_LABEL_LINE_HEIGHT,
}: {
  className?: string;
  font?: string;
  label: string;
  lineHeight?: number;
}) {
  const containerRef = useRef<HTMLSpanElement | null>(null);
  const preparedLabel = useMemo(() => prepareLabelForLayout(label, font), [font, label]);
  const [availableWidth, setAvailableWidth] = useState(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setAvailableWidth(element.clientWidth);
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  const fittedLabel = useMemo(() => {
    if (!preparedLabel) {
      return label;
    }
    if (availableWidth <= 0) {
      return label;
    }

    if (layout(preparedLabel, availableWidth, lineHeight).lineCount <= 1) {
      return label;
    }

    let low = 0;
    let high = label.length;
    let best = "…";

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = `${label.slice(0, mid).trimEnd()}…`;
      const preparedCandidate = prepare(candidate, font);

      if (layout(preparedCandidate, availableWidth, lineHeight).lineCount <= 1) {
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return best;
  }, [availableWidth, font, label, lineHeight, preparedLabel]);

  return (
    <span ref={containerRef} className={cn("min-w-0 flex-1 truncate", className)}>
      {fittedLabel}
    </span>
  );
}
