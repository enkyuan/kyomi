"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@lib/utils";
import { useSidebarReaderFocus } from "@components/ui/sidebar-reader-focus";

const ENTER_EASE = [0.32, 0.72, 0, 1] as const;
const EXIT_EASE = [0.7, 0, 0.84, 0] as const;

const variants = {
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      opacity: {
        delay: 0.02,
        duration: 0.6,
        ease: ENTER_EASE,
      },
      scale: {
        delay: 0.02,
        duration: 0.6,
        ease: ENTER_EASE,
      },
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: {
      opacity: {
        duration: 0.4,
        ease: EXIT_EASE,
      },
      scale: {
        duration: 0.4,
        ease: EXIT_EASE,
      },
    },
  },
  initial: {
    opacity: 0,
    scale: 0.96,
  },
} as const;

export function SidebarModeAnimatedText({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const readerFocusSidebar = useSidebarReaderFocus();
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span className="inline-grid min-w-0 overflow-hidden align-middle [grid-template-areas:'stack']">
      <AnimatePresence initial={false} mode="sync">
        <motion.span
          key={readerFocusSidebar ? "reader-focus" : "split-view"}
          animate="animate"
          className={cn("[grid-area:stack] min-w-0", className)}
          exit="exit"
          initial="initial"
          style={{ transformOrigin: "0 50%" }}
          variants={variants}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
