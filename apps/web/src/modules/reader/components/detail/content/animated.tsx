"use client";

import type { ReactNode } from "react";
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
  springTransition,
} from "@kyomi/ui/lib/motion";

const ARTICLE_REEL_OFFSET = 56;

const articleReelVariants = {
  initial: (direction: 1 | -1) => ({
    opacity: 0,
    y: direction * ARTICLE_REEL_OFFSET,
  }),
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: (direction: 1 | -1) => ({
    opacity: 0,
    y: direction * -ARTICLE_REEL_OFFSET,
  }),
};

export function AnimatedContent({
  contentKey,
  articleStepDirection,
  children,
}: {
  contentKey: string;
  articleStepDirection: 1 | -1;
  children: ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();
  const articleReelTransition = springTransition("emphasized", prefersReducedMotion);

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence initial={false} mode="popLayout" custom={articleStepDirection}>
        <m.div
          key={contentKey}
          custom={articleStepDirection}
          className="min-w-0"
          variants={articleReelVariants}
          initial={prefersReducedMotion ? false : "initial"}
          animate="animate"
          exit={prefersReducedMotion ? undefined : "exit"}
          transition={articleReelTransition}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </LazyMotion>
  );
}
