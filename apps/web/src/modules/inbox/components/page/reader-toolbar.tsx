"use client";

import { m, useReducedMotion } from "motion/react";
import { Toolbar as ReaderToolbarRoot } from "@modules/reader/components/toolbar";
import type { useToolbar as useReaderToolbar } from "@modules/reader/hooks/use-toolbar";

const EXPANDED_READER_TOOLBAR_WIDTH = "13.5625rem";
const COLLAPSED_READER_TOOLBAR_WIDTH = "5.5rem";

export function ReaderToolbar({
  toolbar,
  collapsed,
  tooltipCollisionAvoidance,
  tooltipSide,
}: {
  toolbar: ReturnType<typeof useReaderToolbar>;
  collapsed: boolean;
  tooltipCollisionAvoidance: NonNullable<
    ReturnType<typeof useReaderToolbar>["toolbarProps"]["tooltipCollisionAvoidance"]
  >;
  tooltipSide: NonNullable<ReturnType<typeof useReaderToolbar>["toolbarProps"]["tooltipSide"]>;
}) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.3, bounce: 0 };

  return (
    <m.div
      animate={{
        width: collapsed ? COLLAPSED_READER_TOOLBAR_WIDTH : EXPANDED_READER_TOOLBAR_WIDTH,
      }}
      className="relative inline-flex h-11 min-w-0 shrink-0 origin-left items-center overflow-hidden rounded-full bg-background px-1.5 font-medium text-base text-muted-foreground before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-muted [&>*]:relative"
      initial={false}
      transition={transition}
    >
      <ReaderToolbarRoot
        {...toolbar.toolbarProps}
        controlSize="large"
        hideFontControls
        readerFocusVariant={collapsed ? "compact" : "full"}
        tooltipCollisionAvoidance={tooltipCollisionAvoidance}
        tooltipSide={tooltipSide}
      />
    </m.div>
  );
}
