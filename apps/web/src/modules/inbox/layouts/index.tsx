"use client";

import type { ReactNode } from "react";
import { INBOX_PANEL_OUTER_PADDING_STYLE } from "../lib/layout";

export function ReaderFocusDetailLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-reader-focus-list
      className="flex h-full max-h-full min-h-0 w-full min-w-0 items-stretch justify-center overflow-hidden"
      style={INBOX_PANEL_OUTER_PADDING_STYLE}
    >
      <div className="h-full min-h-0 w-full min-w-0">{children}</div>
    </div>
  );
}

export type { MobileLayoutProps } from "./mobile";
export { MobileLayout } from "./mobile";
export type { SplitLayoutProps } from "./split";
export { SplitLayout } from "./split";
