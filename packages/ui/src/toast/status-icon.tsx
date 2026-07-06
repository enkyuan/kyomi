"use client";

import type { ToastObject } from "@base-ui/react/toast";
import {
  AlertFill,
  CheckCircleFill,
  InformationFill,
  LoadingFill,
  WarningFill,
} from "@mingcute/react";
import type React from "react";
import { cn } from "../lib/utils";

const TOAST_ICONS = {
  error: AlertFill,
  info: InformationFill,
  loading: LoadingFill,
  success: CheckCircleFill,
  warning: WarningFill,
} as const;

type ToastProgressData = {
  progress?: {
    value: number;
    max: number;
    label?: string;
  };
};

function getToastProgress(
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

function ToastProgressIcon({
  progress,
}: {
  progress: NonNullable<ToastProgressData["progress"]>;
}): React.ReactElement {
  const max = Math.max(1, progress.max);
  const value = Math.min(Math.max(progress.value, 0), max);
  const radius = 7;
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
          className="transition-[stroke-dashoffset] duration-300 ease-out"
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

  const iconColor = toastMingcuteIconColor(toast.type);
  const iconClass = toastMingcuteIconClassName(toast.type);

  return (
    <div
      className="[&>svg]:h-lh [&>svg]:w-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"
      data-slot="toast-icon"
    >
      <Icon className={cn("h-4 w-4 shrink-0", iconClass)} color={iconColor} />
    </div>
  );
}

/**
 * Mingcute icons set `style={{ color: "currentColor" }}` on the root SVG, which wins over
 * `text-*` utilities and resolves `currentColor` from the toast surface (popover text), so
 * semantic tints never apply. Pass explicit theme colors via the `color` prop instead.
 */
function toastMingcuteIconColor(type: string | undefined): string {
  switch (type) {
    case "error":
      return "var(--color-destructive)";
    case "success":
      return "var(--color-success)";
    case "info":
      return "var(--color-info)";
    case "warning":
      return "var(--color-warning)";
    case "loading":
      return "var(--color-muted-foreground)";
    default:
      return "var(--color-muted-foreground)";
  }
}

function toastMingcuteIconClassName(type: string | undefined): string {
  return type === "loading" ? "animate-spin opacity-90" : "";
}
