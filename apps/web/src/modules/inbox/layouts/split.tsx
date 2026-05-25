"use client";

import type { ReactNode, RefObject } from "react";
import type { ResizeHandleProps } from "../hooks/use-inbox-layout";
import {
  INBOX_DETAIL_PANEL_OUTER_SPACING_STYLE,
  INBOX_PANEL_SPACING_PX,
  INBOX_PANEL_VERTICAL_PADDING_STYLE,
} from "../lib/layout";

export type SplitLayoutProps = {
  splitContainerRef: RefObject<HTMLDivElement | null>;
  leftPanelPercent: number;
  isResizing: boolean;
  resizeHandleProps: ResizeHandleProps;
  list: ReactNode;
  detail: ReactNode;
};

export function SplitLayout({
  splitContainerRef,
  leftPanelPercent,
  isResizing,
  resizeHandleProps,
  list,
  detail,
}: SplitLayoutProps) {
  return (
    <div
      ref={splitContainerRef}
      className="grid h-full max-h-full min-h-0 min-w-0 flex-1 gap-0 overflow-hidden"
      data-resizing={isResizing ? "true" : undefined}
      style={{
        ...INBOX_PANEL_VERTICAL_PADDING_STYLE,
        gridTemplateColumns: `var(--inbox-left-panel-percent, ${leftPanelPercent}%) ${INBOX_PANEL_SPACING_PX}px minmax(0, 1fr)`,
      }}
    >
      <div className="h-full min-h-0 min-w-0">{list}</div>

      {/* oxlint-disable-next-line -- resize handle: interactive splitter, not a thematic break; <hr> cannot receive pointer events */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels"
        className="group -mx-1 flex h-full w-2 cursor-col-resize touch-none items-stretch justify-center"
        {...resizeHandleProps}
      >
        <div className="h-full w-px bg-transparent opacity-0" />
      </div>

      <div className="h-full min-h-0 min-w-0" style={INBOX_DETAIL_PANEL_OUTER_SPACING_STYLE}>
        {detail}
      </div>
    </div>
  );
}
