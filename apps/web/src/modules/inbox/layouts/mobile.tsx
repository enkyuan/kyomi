"use client";

import { AnimatePresence, LazyMotion, domMax, m, useReducedMotion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { INBOX_PANEL_SPACING_PX } from "./lib/constants";

export type MobileSingleColumnLayoutProps = {
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
