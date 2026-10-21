"use client";

import type { ToastObject } from "@base-ui/react/toast";
import { Toast } from "@base-ui/react/toast";
import type React from "react";
import { TextMorph } from "../text-morph";

type ToastData = ToastObject<Record<string, unknown>>;

// A 360px toast fits about 40 characters of 14px text beside its icon; anchored cards are narrower.
const DEFAULT_MORPH_MAX_CHARS = 40;

interface ToastTextProps {
  toast: ToastData;
  /** Longest text, in characters, that is still known to fit on one line. */
  maxMorphChars?: number;
}

// TextMorph lays its text out on one line, so anything that could wrap stays plain text and changes
// without a morph instead of overflowing the toast.
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
    <TextMorph>{text}</TextMorph>
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

/** The toast's description, morphing in place alongside its title. */
export function ToastDescription({
  toast,
  maxMorphChars = DEFAULT_MORPH_MAX_CHARS,
  ...props
}: Omit<Toast.Description.Props, "children"> & ToastTextProps): React.ReactElement | null {
  return toast.description ? (
    <Toast.Description {...props}>
      <ToastMorph maxChars={maxMorphChars}>{toast.description}</ToastMorph>
    </Toast.Description>
  ) : null;
}
