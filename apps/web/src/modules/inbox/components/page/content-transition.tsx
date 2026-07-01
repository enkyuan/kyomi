"use client";

import type { ReactNode } from "react";
import { AnimatePresence, LayoutGroup, LazyMotion, domMax, m, useReducedMotion } from "motion/react";

export function ContentTransition({
  showDetail,
  list,
  detail,
}: {
  showDetail: boolean;
  list: ReactNode;
  detail: ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.28, bounce: 0 };

  return (
    <LazyMotion features={domMax}>
      <m.div initial={false} className="relative h-full min-h-0 min-w-0 flex-1 overflow-hidden">
        <LayoutGroup id="inbox-middle-column">
          <AnimatePresence initial={false} mode="sync">
            {showDetail ? (
              <m.div
                key="middle-article"
                className="absolute inset-0 flex min-h-0 min-w-0 flex-col"
                initial={prefersReducedMotion ? false : { opacity: 0, x: 18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, x: -12 }}
                transition={transition}
              >
                {detail}
              </m.div>
            ) : (
              <m.div
                key="middle-inbox"
                className="absolute inset-0 flex min-h-0 min-w-0 flex-col"
                initial={prefersReducedMotion ? false : { opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, x: 18 }}
                transition={transition}
              >
                {list}
              </m.div>
            )}
          </AnimatePresence>
        </LayoutGroup>
      </m.div>
    </LazyMotion>
  );
}
