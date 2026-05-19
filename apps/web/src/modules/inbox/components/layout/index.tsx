"use client";

import { AnimatePresence, LazyMotion, domMax, m, useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import {
  INBOX_DETAIL_PANEL_OUTER_SPACING_STYLE,
  INBOX_PANEL_OUTER_PADDING_STYLE,
  INBOX_PANEL_SPACING_PX,
  INBOX_PANEL_VERTICAL_PADDING_STYLE,
} from "./constants";

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

export function ReaderFocusDetailLayout({ children }: { children: ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.34, bounce: 0 };

  const isMounted = useClientMounted();

  return (
    <LazyMotion features={domMax}>
      <m.div
        initial={false}
        data-reader-focus-list
        className="flex h-full max-h-full min-h-0 w-full min-w-0 items-stretch justify-center overflow-hidden"
        style={INBOX_PANEL_OUTER_PADDING_STYLE}
        layout
        transition={transition}
      >
        <m.div
          initial={false}
          className="h-full min-h-0 w-full min-w-0"
          layout={isMounted ? true : undefined}
          layoutId="inbox-detail-panel"
          transition={transition}
        >
          {children}
        </m.div>
      </m.div>
    </LazyMotion>
  );
}

type MobileSingleColumnLayoutProps = {
  showDetail: boolean;
  direction: 1 | -1;
  list: ReactNode;
  detail: ReactNode;
};

export function MobileSingleColumnLayout({
  showDetail,
  direction,
  list,
  detail,
}: MobileSingleColumnLayoutProps) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.34, bounce: 0 };
  const slideOffset = direction * 28;

  return (
    <LazyMotion features={domMax}>
      <m.div
        initial={false}
        className="relative h-full max-h-full min-h-0 w-full min-w-0 overflow-hidden [--inbox-stacked-left-inset:var(--inbox-stacked-panel-inset)] md:[--inbox-stacked-left-inset:0px]"
        style={
          {
            "--inbox-stacked-panel-inset": `${INBOX_PANEL_SPACING_PX}px`,
          } as CSSProperties
        }
      >
        <AnimatePresence initial={false} mode="popLayout">
          {showDetail ? (
            <m.div
              key="inbox-detail"
              initial={prefersReducedMotion ? false : { opacity: 0, x: slideOffset }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, x: -slideOffset }}
              transition={transition}
              className="absolute bottom-(--inbox-stacked-panel-inset) left-(--inbox-stacked-left-inset) right-(--inbox-stacked-panel-inset) top-(--inbox-stacked-panel-inset) flex min-h-0 min-w-0 flex-col"
            >
              {detail}
            </m.div>
          ) : (
            <m.div
              key="inbox-list"
              initial={prefersReducedMotion ? false : { opacity: 0, x: -slideOffset }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, x: slideOffset }}
              transition={transition}
              className="absolute bottom-(--inbox-stacked-panel-inset) left-(--inbox-stacked-left-inset) right-(--inbox-stacked-panel-inset) top-(--inbox-stacked-panel-inset) flex min-h-0 min-w-0 flex-col"
            >
              {list}
            </m.div>
          )}
        </AnimatePresence>
      </m.div>
    </LazyMotion>
  );
}

type SplitLayoutProps = {
  splitContainerRef: RefObject<HTMLDivElement | null>;
  leftPanelPercent: number;
  isResizing: boolean;
  setIsResizing: (value: boolean) => void;
  list: ReactNode;
  detail: ReactNode;
};

export function SplitLayout({
  splitContainerRef,
  leftPanelPercent,
  isResizing,
  setIsResizing,
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
        onPointerDown={(event) => {
          event.preventDefault();
          setIsResizing(true);
        }}
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
