"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import type { ReactNode, RefObject } from "react";
import {
  INBOX_DETAIL_PANEL_OUTER_SPACING_STYLE,
  INBOX_PANEL_OUTER_PADDING_STYLE,
  INBOX_PANEL_SPACING_PX,
  INBOX_PANEL_VERTICAL_PADDING_STYLE,
} from "./inbox-layout-constants";

export function InboxReaderFocusDetailLayout({ children }: { children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.34, bounce: 0 };

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  return (
    <motion.div
      initial={false}
      data-reader-focus-list
      className="flex h-full max-h-full min-h-0 w-full min-w-0 items-stretch justify-center overflow-hidden"
      style={INBOX_PANEL_OUTER_PADDING_STYLE}
      layout
      transition={transition}
    >
      <motion.div
        initial={false}
        className="h-full min-h-0 w-full min-w-0"
        layout={isMounted ? true : undefined}
        layoutId="inbox-detail-panel"
        transition={transition}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function InboxReaderFocusListLayout({ children }: { children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.34, bounce: 0 };

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  return (
    <motion.div
      initial={false}
      data-reader-focus-list
      className="flex h-full max-h-full min-h-0 w-full min-w-0 items-stretch justify-center overflow-hidden"
      style={INBOX_PANEL_OUTER_PADDING_STYLE}
      layout
      transition={transition}
    >
      <motion.div
        initial={false}
        className="h-full min-h-0 w-full min-w-0"
        layout={isMounted ? true : undefined}
        layoutId="inbox-list-panel"
        transition={transition}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

type InboxSplitLayoutProps = {
  splitContainerRef: RefObject<HTMLDivElement | null>;
  leftPanelPercent: number;
  isResizing: boolean;
  setIsResizing: (value: boolean) => void;
  list: ReactNode;
  detail: ReactNode;
};

export function InboxSplitLayout({
  splitContainerRef,
  leftPanelPercent,
  isResizing,
  setIsResizing,
  list,
  detail,
}: InboxSplitLayoutProps) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.34, bounce: 0 };

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const panelTransition = isResizing ? { duration: 0 } : transition;

  return (
    <div
      ref={splitContainerRef}
      className="grid h-full max-h-full min-h-0 min-w-0 flex-1 gap-0 overflow-hidden"
      data-resizing={isResizing ? "true" : undefined}
      style={{
        ...INBOX_PANEL_VERTICAL_PADDING_STYLE,
        gridTemplateColumns: `var(--inbox-left-panel-percent, ${leftPanelPercent}%) ${INBOX_PANEL_SPACING_PX}px minmax(0, 1fr)`,
      }}
    >
      <motion.div
        initial={false}
        className="h-full min-h-0 min-w-0"
        layout={isMounted && !isResizing ? true : undefined}
        layoutId="inbox-list-panel"
        transition={panelTransition}
      >
        {list}
      </motion.div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        className="group -mx-1 flex h-full w-2 cursor-col-resize touch-none items-stretch justify-center"
        onPointerDown={(event) => {
          event.preventDefault();
          setIsResizing(true);
        }}
      >
        <div className="h-full w-px bg-transparent opacity-0" />
      </div>

      <motion.div
        initial={false}
        className="h-full min-h-0 min-w-0"
        style={INBOX_DETAIL_PANEL_OUTER_SPACING_STYLE}
        layout={isMounted && !isResizing ? true : undefined}
        layoutId="inbox-detail-panel"
        transition={panelTransition}
      >
        {detail}
      </motion.div>
    </div>
  );
}
