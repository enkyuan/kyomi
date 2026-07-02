"use client";

import type React from "react";
import { CheckFill, Copy2Line } from "@mingcute/react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";

const COPY_ICON_TRANSITION = { type: "spring" as const, duration: 0.3, bounce: 0 };
const COPY_ICON_STATE = {
  opacity: 1,
  scale: 1,
  filter: "blur(0px)",
};
const COPY_ICON_HIDDEN_STATE = {
  opacity: 0,
  scale: 0.25,
  filter: "blur(4px)",
};

export type CopyIconProps = {
  isCopied: boolean;
  className?: string;
};

export function CopyIcon({ isCopied, className }: CopyIconProps): React.ReactElement {
  const prefersReducedMotion = useReducedMotion();
  const Icon = isCopied ? CheckFill : Copy2Line;

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={isCopied ? "check" : "copy"}
          className="flex items-center justify-center"
          initial={prefersReducedMotion ? false : COPY_ICON_HIDDEN_STATE}
          animate={COPY_ICON_STATE}
          exit={prefersReducedMotion ? undefined : COPY_ICON_HIDDEN_STATE}
          transition={prefersReducedMotion ? { duration: 0 } : COPY_ICON_TRANSITION}
        >
          <Icon className={className} />
        </m.span>
      </AnimatePresence>
    </LazyMotion>
  );
}
