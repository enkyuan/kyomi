"use client";

import { LazyMotion, domMax, m, useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";
import type { ReactNode, RefObject } from "react";
import type { ResizeHandleProps } from "../hooks/use-split-pane";
import {
  INBOX_DETAIL_PANEL_OUTER_SPACING_STYLE,
  INBOX_PANEL_SPACING_PX,
  INBOX_PANEL_VERTICAL_PADDING_STYLE,
} from "../lib/constants";

function subscribeNoop() {
  return () => {};
}

function getClientMounted() {
  return true;
}

function getServerMounted() {
  return false;
}

function useClientMounted() {
  return useSyncExternalStore(subscribeNoop, getClientMounted, getServerMounted);
}

export type SplitLayoutProps = {
  splitContainerRef: RefObject<HTMLDivElement | null>;
  leftPanelPercent: number;
  isResizing: boolean;
  resizeHandleProps: ResizeHandleProps;
  list: ReactNode;
  detail: ReactNode;
};

export function SplitLayout({
  splitContainerRef,
  leftPanelPercent,
  isResizing,
  resizeHandleProps,
  list,
  detail,
}: SplitLayoutProps) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.34, bounce: 0 };

  const isMounted = useClientMounted();
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
      <LazyMotion features={domMax}>
        <m.div
          initial={false}
          className="h-full min-h-0 min-w-0"
          layout={isMounted && !isResizing ? true : undefined}
          layoutId="inbox-list-panel"
          transition={panelTransition}
        >
          {list}
        </m.div>
      </LazyMotion>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        className="group -mx-1 flex h-full w-2 cursor-col-resize touch-none items-stretch justify-center"
        {...resizeHandleProps}
      >
        <div className="h-full w-px bg-transparent opacity-0" />
      </div>

      <LazyMotion features={domMax}>
        <m.div
          initial={false}
          className="h-full min-h-0 min-w-0"
          style={INBOX_DETAIL_PANEL_OUTER_SPACING_STYLE}
          layout={isMounted && !isResizing ? true : undefined}
          layoutId="inbox-detail-panel"
          transition={panelTransition}
        >
          {detail}
        </m.div>
      </LazyMotion>
    </div>
  );
}
