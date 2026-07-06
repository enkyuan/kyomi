"use client";

import { DownFill, UpFill } from "@kyomi/ui/icons/mingcute";
import { m, useReducedMotion } from "@kyomi/ui/motion";
import { Button } from "@kyomi/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/tooltip";
import { Toolbar as ReaderToolbarRoot } from "@modules/reader/components/toolbar";
import type { ToolbarModel } from "@modules/toolbar/lib/types";

const EXPANDED_READER_TOOLBAR_WIDTH = "13.5625rem";
const COLLAPSED_READER_TOOLBAR_WIDTH = "5.5rem";
const STEP_CONTROL_TOOLTIP_SIDE = "bottom";
const STEP_CONTROL_TOOLTIP_SIDE_OFFSET = 8;
const STEP_CONTROL_TOOLTIP_COLLISION_AVOIDANCE = {
  side: "shift",
  align: "shift",
  fallbackAxisSide: "none",
} as const;

type ReaderToolbarProps =
  | {
      variant?: "controls";
      toolbar: ToolbarModel;
      collapsed: boolean;
      tooltipCollisionAvoidance: NonNullable<
        ToolbarModel["toolbarProps"]["tooltipCollisionAvoidance"]
      >;
      tooltipSide: NonNullable<ToolbarModel["toolbarProps"]["tooltipSide"]>;
    }
  | {
      variant: "navigation";
      canSelectPreviousItem: boolean;
      canSelectNextItem: boolean;
      onSelectPreviousItem: () => void;
      onSelectNextItem: () => void;
    };

export function ReaderToolbar(props: ReaderToolbarProps) {
  const prefersReducedMotion = Boolean(useReducedMotion());
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.3, bounce: 0 };

  if (props.variant === "navigation") {
    return (
      <nav
        aria-label="Article navigation"
        className="relative flex h-11 w-21 shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full bg-background p-1 text-muted-foreground before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-muted [&>*]:relative"
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Previous article"
                className="size-9 rounded-full text-muted-foreground transition-colors hover:text-foreground"
                disabled={!props.canSelectPreviousItem}
                size="icon-lg"
                variant="ghost"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  props.onSelectPreviousItem();
                }}
              />
            }
          >
            <UpFill className="size-4" />
          </TooltipTrigger>
          <TooltipPopup
            collisionAvoidance={STEP_CONTROL_TOOLTIP_COLLISION_AVOIDANCE}
            side={STEP_CONTROL_TOOLTIP_SIDE}
            sideOffset={STEP_CONTROL_TOOLTIP_SIDE_OFFSET}
          >
            Previous article
          </TooltipPopup>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Next article"
                className="size-9 rounded-full text-muted-foreground transition-colors hover:text-foreground"
                disabled={!props.canSelectNextItem}
                size="icon-lg"
                variant="ghost"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  props.onSelectNextItem();
                }}
              />
            }
          >
            <DownFill className="size-4" />
          </TooltipTrigger>
          <TooltipPopup
            collisionAvoidance={STEP_CONTROL_TOOLTIP_COLLISION_AVOIDANCE}
            side={STEP_CONTROL_TOOLTIP_SIDE}
            sideOffset={STEP_CONTROL_TOOLTIP_SIDE_OFFSET}
          >
            Next article
          </TooltipPopup>
        </Tooltip>
      </nav>
    );
  }

  return (
    <m.div
      animate={{
        width: props.collapsed ? COLLAPSED_READER_TOOLBAR_WIDTH : EXPANDED_READER_TOOLBAR_WIDTH,
      }}
      className="relative inline-flex h-11 min-w-0 shrink-0 origin-left items-center overflow-hidden rounded-full bg-background px-1.5 font-medium text-base text-muted-foreground before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-muted [&>*]:relative"
      initial={false}
      transition={transition}
    >
      <ReaderToolbarRoot
        {...props.toolbar.toolbarProps}
        controlSize="large"
        hideFontControls
        readerFocusVariant={props.collapsed ? "compact" : "full"}
        tooltipCollisionAvoidance={props.tooltipCollisionAvoidance}
        tooltipSide={props.tooltipSide}
      />
    </m.div>
  );
}
