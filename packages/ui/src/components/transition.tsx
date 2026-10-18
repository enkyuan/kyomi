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
import { cn } from "../lib/utils";

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

export const TRANSITION_EASE_OUT = [0.23, 1, 0.32, 1] as const;

export const DEFAULT_TRANSITION = {
  type: "tween" as const,
  duration: 0.2,
  ease: TRANSITION_EASE_OUT,
};
const DEFAULT_OFFSET_PX = 18;
const DEFAULT_CONTENT_CLASS_NAME = "absolute inset-0 flex min-h-0 min-w-0 flex-col";
export const REDUCED_MOTION_TRANSITION = {
  duration: 0.15,
  ease: TRANSITION_EASE_OUT,
};

function resolveOffset(offset: TransitionOffset, direction: TransitionDirection) {
  if (typeof offset !== "number") {
    return offset[direction];
  }

  return direction === "forward"
    ? { enter: offset, exit: -offset }
    : { enter: -offset, exit: offset };
}

function resolveTransform(axis: TransitionAxis, offset: number) {
  return axis === "x" ? `translate3d(${offset}px, 0, 0)` : `translate3d(0, ${offset}px, 0)`;
}

export function resolveTransitionStates({
  axis,
  direction,
  offset,
  prefersReducedMotion,
  transition = DEFAULT_TRANSITION,
}: {
  axis: TransitionAxis;
  direction: TransitionDirection;
  offset: TransitionOffset;
  prefersReducedMotion: boolean;
  transition?: MotionTransition;
}) {
  const resolvedOffset = resolveOffset(offset, direction);
  const restingTransform = resolveTransform(axis, 0);

  return {
    animate: { opacity: 1, transform: restingTransform },
    exit: prefersReducedMotion
      ? { opacity: 0, transform: restingTransform }
      : { opacity: 0, transform: resolveTransform(axis, resolvedOffset.exit) },
    initial: prefersReducedMotion
      ? { opacity: 0, transform: restingTransform }
      : { opacity: 0, transform: resolveTransform(axis, resolvedOffset.enter) },
    transition: prefersReducedMotion ? REDUCED_MOTION_TRANSITION : transition,
  };
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
  const states = resolveTransitionStates({
    axis,
    direction,
    offset,
    prefersReducedMotion,
    transition,
  });
  const featureBundle = features === "max" ? domMax : domAnimation;
  const content = (
    <AnimatePresence initial={false} mode={mode}>
      <m.div
        key={contentKey}
        animate={states.animate}
        className={cn(DEFAULT_CONTENT_CLASS_NAME, contentClassName)}
        exit={states.exit}
        initial={states.initial}
        transition={states.transition}
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
