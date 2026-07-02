"use client";

import type { ReactNode } from "react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { cn } from "@lib/utils";

export type RecapScreenDirection = "forward" | "backward";

type RecapScreenMotionState = {
  direction: RecapScreenDirection;
  reducedMotion: boolean;
};

const RECAP_SCREEN_OFFSET_PX = 28;

const recapScreenVariants = {
  initial: ({ direction, reducedMotion }: RecapScreenMotionState) => ({
    opacity: reducedMotion ? 1 : 0,
    x: reducedMotion
      ? 0
      : direction === "forward"
        ? RECAP_SCREEN_OFFSET_PX
        : -RECAP_SCREEN_OFFSET_PX,
  }),
  animate: {
    opacity: 1,
    x: 0,
  },
  exit: ({ direction, reducedMotion }: RecapScreenMotionState) => ({
    opacity: reducedMotion ? 1 : 0,
    x: reducedMotion
      ? 0
      : direction === "forward"
        ? -RECAP_SCREEN_OFFSET_PX
        : RECAP_SCREEN_OFFSET_PX,
  }),
};

export function RecapScreenTransition({
  children,
  className,
  contentKey,
  direction,
}: {
  children: ReactNode;
  className?: string;
  contentKey: string;
  direction: RecapScreenDirection;
}) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const transitionState: RecapScreenMotionState = {
    direction,
    reducedMotion: prefersReducedMotion,
  };
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.28, bounce: 0 };

  return (
    <LazyMotion features={domAnimation}>
      <m.div className={cn("relative min-h-0 min-w-0 overflow-hidden", className)} initial={false}>
        <AnimatePresence custom={transitionState} initial={false} mode="popLayout">
          <m.div
            key={contentKey}
            animate="animate"
            className="absolute inset-0 flex min-h-0 min-w-0 flex-col"
            custom={transitionState}
            exit="exit"
            initial="initial"
            transition={transition}
            variants={recapScreenVariants}
          >
            {children}
          </m.div>
        </AnimatePresence>
      </m.div>
    </LazyMotion>
  );
}
