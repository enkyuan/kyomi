"use client";

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckFill, Copy2Line } from "@mingcute/react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";

const COPY_FEEDBACK_DURATION_MS = 1200;
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

export function useCopyFeedback() {
  const [isCopied, setIsCopied] = useState(false);
  const resetTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>> | null>(null);
  resetTimeoutsRef.current ??= new Set();
  const resetTimeouts = resetTimeoutsRef.current;

  const showCopyFeedback = useCallback(() => {
    for (const timeout of resetTimeouts) {
      clearTimeout(timeout);
    }
    resetTimeouts.clear();

    setIsCopied(true);
    const timeout = setTimeout(() => {
      setIsCopied(false);
      resetTimeouts.delete(timeout);
    }, COPY_FEEDBACK_DURATION_MS);
    resetTimeouts.add(timeout);
  }, [resetTimeouts]);

  useEffect(() => {
    return () => {
      for (const timeout of resetTimeouts) {
        clearTimeout(timeout);
      }
      resetTimeouts.clear();
    };
  }, [resetTimeouts]);

  return { isCopied, showCopyFeedback };
}

export function CopyFeedbackIcon({
  isCopied,
  className,
}: {
  isCopied: boolean;
  className?: string;
}): React.ReactElement {
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
