"use client";

import type { ReactNode } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  LazyMotion,
  domAnimation,
  domMax,
  m,
  useReducedMotion,
  type Transition as MotionTransition,
} from "motion/react";
import { cn } from "./lib/utils";

export type TransitionDirection = "forward" | "backward";
export type TransitionAxis = "x" | "y";
export type TransitionFeatureSet = "animation" | "max";
export type TransitionMode = "sync" | "popLayout" | "wait";

type DirectionalOffset = {
  enter: number;
  exit: number;
};

export type TransitionOffset =
  | number
  | {
      forward: DirectionalOffset;
      backward: DirectionalOffset;
    };

const DEFAULT_TRANSITION = { type: "spring" as const, duration: 0.28, bounce: 0 };
const DEFAULT_OFFSET_PX = 18;
const DEFAULT_CONTENT_CLASS_NAME = "absolute inset-0 flex min-h-0 min-w-0 flex-col";

function resolveOffset(offset: TransitionOffset, direction: TransitionDirection) {
  if (typeof offset !== "number") {
    return offset[direction];
  }

  return direction === "forward"
    ? { enter: offset, exit: -offset }
    : { enter: -offset, exit: offset };
}

export type TransitionProps = {
  axis?: TransitionAxis;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  contentKey: string;
  direction?: TransitionDirection;
  features?: TransitionFeatureSet;
  layoutGroupId?: string;
  mode?: TransitionMode;
  offset?: TransitionOffset;
  transition?: MotionTransition;
};

export function Transition({
  axis = "x",
  children,
  className,
  contentClassName,
  contentKey,
  direction = "forward",
  features = "animation",
  layoutGroupId,
  mode = "popLayout",
  offset = DEFAULT_OFFSET_PX,
  transition = DEFAULT_TRANSITION,
}: TransitionProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const resolvedOffset = resolveOffset(offset, direction);
  const motionAxis = axis === "x" ? "x" : "y";
  const featureBundle = features === "max" ? domMax : domAnimation;
  const content = (
    <AnimatePresence initial={false} mode={mode}>
      <m.div
        key={contentKey}
        animate={{ opacity: 1, [motionAxis]: 0 }}
        className={cn(DEFAULT_CONTENT_CLASS_NAME, contentClassName)}
        exit={prefersReducedMotion ? undefined : { opacity: 0, [motionAxis]: resolvedOffset.exit }}
        initial={prefersReducedMotion ? false : { opacity: 0, [motionAxis]: resolvedOffset.enter }}
        transition={prefersReducedMotion ? { duration: 0 } : transition}
      >
        {children}
      </m.div>
    </AnimatePresence>
  );

  return (
    <LazyMotion features={featureBundle}>
      <m.div className={className} initial={false}>
        {layoutGroupId ? <LayoutGroup id={layoutGroupId}>{content}</LayoutGroup> : content}
      </m.div>
    </LazyMotion>
  );
}
