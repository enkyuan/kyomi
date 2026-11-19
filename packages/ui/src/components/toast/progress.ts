import type { ToastObject } from "@base-ui/react/toast";

export type ToastProgressData = {
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
