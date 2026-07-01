"use client";

import { m, useReducedMotion } from "motion/react";
import { Toolbar as ReaderToolbarRoot } from "@modules/reader/components/toolbar";
import type { useToolbar as useReaderToolbar } from "@modules/reader/hooks/use-toolbar";

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
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.3, bounce: 0 };

  return (
    <m.div
      layout
      className="relative inline-flex h-11 min-w-0 max-w-96 items-center overflow-hidden rounded-full bg-background px-1.5 font-medium text-base text-muted-foreground before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-muted [&>*]:relative"
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
