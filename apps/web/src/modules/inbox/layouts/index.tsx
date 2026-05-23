"use client";

import { LazyMotion, domMax, m, useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { INBOX_PANEL_OUTER_PADDING_STYLE } from "../lib/constants";

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

export type { MobileSingleColumnLayoutProps } from "./mobile";
export { MobileSingleColumnLayout } from "./mobile";
export type { SplitLayoutProps } from "./split";
export { SplitLayout } from "./split";
