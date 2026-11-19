"use client";

import type { ToastObject } from "@base-ui/react/toast";
import {
  CheckCircle2FilledIcon,
  CircleXFilledIcon,
  ExclamationCircleFilledIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
} from "blode-icons-react";
import type React from "react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "../../lib/motion";
import { cn } from "../../lib/utils";
import { getToastProgress, type ToastProgressData } from "./progress";

const TOAST_ICONS = {
  error: CircleXFilledIcon,
  info: ExclamationCircleFilledIcon,
  loading: LoaderCircleIcon,
  success: CheckCircle2FilledIcon,
  warning: TriangleAlertIcon,
} as const;

function ToastProgressIcon({
  progress,
}: {
  progress: NonNullable<ToastProgressData["progress"]>;
}): React.ReactElement {
  const max = Math.max(1, progress.max);
  const value = Math.min(Math.max(progress.value, 0), max);
  // Outer diameter 15 of the 18-unit box (13.3px of 16), the drawn size of the other status icons,
  // so the ring starts as far from the toast's edge as they do.
  const radius = 6.5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / max) * circumference;

  return (
    <div className="grid h-4 w-4 shrink-0 place-items-center text-muted-foreground">
      <progress
        aria-label={progress.label ?? "Import progress"}
        className="sr-only"
        max={max}
        value={value}
      />
      <svg aria-hidden="true" className="h-4 w-4 -rotate-90" viewBox="0 0 18 18">
        <circle
          className="opacity-20"
          cx="9"
          cy="9"
          fill="none"
          r={radius}
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle
          className="transition-[stroke-dashoffset] duration-240 ease-out-quint motion-reduce:transition-none"
          cx="9"
          cy="9"
          fill="none"
          r={radius}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

// A state change swaps the glyph in place: the old icon shrinks and fades out while the new one
// grows in from the same spot a beat later, so a toast never shows two icons side by side.
const ICON_SPRING = {
  type: "spring",
  mass: 4,
  stiffness: 800,
  damping: 80,
  restDelta: 0.0001,
} as const;
const ICON_HIDDEN = { opacity: 0, scale: 0.6 };
const ICON_SHOWN = { opacity: 1, scale: 1 };
const ICON_INSTANT = { duration: 0 };

export function ToastStatusIcon({
  toast,
}: {
  toast: ToastObject<Record<string, unknown>>;
}): React.ReactElement | null {
  const prefersReducedMotion = useReducedMotion();
  const progress = getToastProgress(toast);
  const Icon = toast.type ? TOAST_ICONS[toast.type as keyof typeof TOAST_ICONS] : null;
  if (!progress && !Icon) {
    return null;
  }

  // The ring and each type are separate states; the ring keeps its key while the count moves, so
  // its stroke still eases between steps instead of remounting.
  const state = progress ? "progress" : (toast.type ?? "none");

  return (
    <LazyMotion features={domAnimation}>
      <div
        className="grid h-lh w-4 shrink-0 place-items-center [&_svg]:pointer-events-none [&_svg]:shrink-0"
        data-slot="toast-icon"
      >
        <AnimatePresence initial={false}>
          <m.div
            animate={ICON_SHOWN}
            className="col-start-1 row-start-1 grid place-items-center"
            exit={{
              ...ICON_HIDDEN,
              transition: prefersReducedMotion ? ICON_INSTANT : ICON_SPRING,
            }}
            initial={ICON_HIDDEN}
            key={state}
            transition={prefersReducedMotion ? ICON_INSTANT : { ...ICON_SPRING, delay: 0.1 }}
          >
            {progress ? (
              <ToastProgressIcon progress={progress} />
            ) : Icon ? (
              <Icon className={cn("h-4 w-4 shrink-0", toastIconClassName(toast.type))} />
            ) : null}
          </m.div>
        </AnimatePresence>
      </div>
    </LazyMotion>
  );
}

const TOAST_ICON_CLASS_NAMES = {
  error: "text-destructive",
  info: "text-info",
  loading: "animate-spin text-muted-foreground opacity-90",
  success: "text-success",
  warning: "text-warning",
} as const;

function toastIconClassName(type: string | undefined): string {
  return (
    TOAST_ICON_CLASS_NAMES[type as keyof typeof TOAST_ICON_CLASS_NAMES] ?? "text-muted-foreground"
  );
}
