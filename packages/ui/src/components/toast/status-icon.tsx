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
import { cn } from "../../lib/utils";

const TOAST_ICONS = {
  error: CircleXFilledIcon,
  info: ExclamationCircleFilledIcon,
  loading: LoaderCircleIcon,
  success: CheckCircle2FilledIcon,
  warning: TriangleAlertIcon,
} as const;

type ToastProgressData = {
  progress?: {
    value: number;
    max: number;
    label?: string;
  };
};

export function getToastProgress(
  toast: ToastObject<Record<string, unknown>>,
): ToastProgressData["progress"] | null {
  const progress = (toast.data as ToastProgressData | undefined)?.progress;
  if (!progress || !Number.isFinite(progress.value) || !Number.isFinite(progress.max)) {
    return null;
  }
  if (progress.max <= 0) {
    return null;
  }
  return progress;
}

/** The count shown at a toast's end, e.g. `4/10`; finished work never reads past its total. */
export function formatToastProgress(progress: NonNullable<ToastProgressData["progress"]>): string {
  const value = Math.min(Math.max(Math.round(progress.value), 0), Math.ceil(progress.max));
  return `${value}/${Math.ceil(progress.max)}`;
}

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

export function ToastStatusIcon({
  toast,
}: {
  toast: ToastObject<Record<string, unknown>>;
}): React.ReactElement | null {
  const progress = getToastProgress(toast);
  if (progress) {
    return (
      <div data-slot="toast-icon">
        <ToastProgressIcon progress={progress} />
      </div>
    );
  }

  const Icon = toast.type ? TOAST_ICONS[toast.type as keyof typeof TOAST_ICONS] : null;
  if (!Icon) {
    return null;
  }

  return (
    <div
      className="[&>svg]:h-lh [&>svg]:w-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"
      data-slot="toast-icon"
    >
      <Icon className={cn("h-4 w-4 shrink-0", toastIconClassName(toast.type))} />
    </div>
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
