"use client";

import type { ToastObject } from "@base-ui/react/toast";
import { Toast } from "@base-ui/react/toast";
import type React from "react";
import { TextMorph } from "../text-morph";

type ToastData = ToastObject<Record<string, unknown>>;

// A state change reads as one line settling into the next, so titles morph slower and softer than
// the count beside them (which has to stay in step with the progress ring).
const TITLE_MORPH_DURATION_MS = 600;
const TITLE_MORPH_EASE = "cubic-bezier(0.41, 1.03, 0.6, 1.03)";

// A 360px toast fits about 40 characters of 14px text beside its icon; anchored cards are narrower.
const DEFAULT_MORPH_MAX_CHARS = 40;

interface ToastTextProps {
  toast: ToastData;
  /** Longest text, in characters, that is still known to fit on one line. */
  maxMorphChars?: number;
}

// TextMorph lays its text out on one line, so anything that could overflow stays plain text and
// changes without a morph; the title's own truncation then ends it with an ellipsis.
function ToastMorph({
  children,
  maxChars,
}: {
  children: ToastData["title"];
  maxChars: number;
}): React.ReactNode {
  const text =
    typeof children === "string" || typeof children === "number" ? String(children) : null;

  return text !== null && text.length <= maxChars && !text.includes("\n") ? (
    <TextMorph duration={TITLE_MORPH_DURATION_MS} ease={TITLE_MORPH_EASE}>
      {text}
    </TextMorph>
  ) : (
    children
  );
}

/** The toast's title, morphing in place when a loading toast settles into success or error. */
export function ToastTitle({
  toast,
  maxMorphChars = DEFAULT_MORPH_MAX_CHARS,
  ...props
}: Omit<Toast.Title.Props, "children"> & ToastTextProps): React.ReactElement | null {
  return toast.title ? (
    <Toast.Title {...props}>
      <ToastMorph maxChars={maxMorphChars}>{toast.title}</ToastMorph>
    </Toast.Title>
  ) : null;
}
