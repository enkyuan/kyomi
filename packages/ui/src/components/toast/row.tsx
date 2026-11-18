"use client";

import { Toast } from "@base-ui/react/toast";
import type { ToastObject } from "@base-ui/react/toast";
import type React from "react";
import { TextMorph } from "../text-morph";
import { formatToastProgress, getToastProgress, ToastStatusIcon } from "./status-icon";
import { ToastTitle } from "./text";

/**
 * Padding at a toast's start and end, from the icon's edge and the end slot's edge. The icon's
 * glyph is drawn 1.3px inside its 16px box, so the start reads 13.3px from the edge; a count at
 * the end takes the same 13px so both ends of the line sit equally far in. An action button
 * instead sits `--toast-inset` from the end (see `ToastContent`), concentric with the toast's
 * corner, and its own padding brings its label to the same optical inset.
 */
export const TOAST_CONTENT_CLASS_NAME =
  "pointer-events-auto flex min-h-10 items-center gap-2 overflow-hidden ps-3 pe-[13px] text-sm leading-5 transition-opacity duration-150 has-data-[slot=toast-action]:pe-(--toast-inset) data-behind:not-data-expanded:pointer-events-none data-behind:opacity-0 data-expanded:opacity-100";

/**
 * One line: status icon, title, then an end slot for a count (`4/10`) or the toast's action
 * (undo, retry). Both are pushed to the end edge; nothing wraps, a long title truncates. The count
 * is tabular and morphs by place value on the ring's own duration and curve, so a step up or down
 * moves the digits and the ring together and the line never shifts under it.
 */
export function ToastRow({
  toast,
  maxMorphChars,
}: {
  toast: ToastObject<Record<string, unknown>>;
  maxMorphChars?: number;
}): React.ReactElement {
  const progress = getToastProgress(toast);

  return (
    <>
      <ToastStatusIcon toast={toast} />
      <ToastTitle
        className="min-w-0 flex-1 truncate font-medium"
        data-slot="toast-title"
        maxMorphChars={maxMorphChars}
        toast={toast}
      />
      {progress ? (
        <span
          className="inline-flex shrink-0 text-muted-foreground tabular-nums"
          data-slot="toast-count"
        >
          <TextMorph>{formatToastProgress(progress)}</TextMorph>
        </span>
      ) : null}
      {toast.actionProps ? (
        <Toast.Action
          className="relative h-7 shrink-0 cursor-pointer rounded-[calc(var(--toast-radius)-var(--toast-inset))] bg-foreground/8 px-2 font-medium text-foreground outline-none transition-[background-color,scale] duration-150 ease-out-quint after:absolute after:-inset-(--toast-inset) hover:bg-foreground/12 focus-visible:ring-2 focus-visible:ring-ring motion-safe:active:scale-96 active:bg-foreground/16"
          data-slot="toast-action"
        >
          {toast.actionProps.children}
        </Toast.Action>
      ) : null}
    </>
  );
}
