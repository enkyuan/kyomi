"use client";

import { ChevronDownIcon, ChevronUpIcon } from "@kyomi/ui/icons/blode";
import { Button } from "@kyomi/ui/components/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/components/tooltip";
import { Toolbar as ReaderToolbarRoot } from "@modules/reader/components/toolbar";
import type { ToolbarModel } from "@modules/reader/lib/toolbar";

/** Width of a toolbar holding `buttons` size-9 buttons, gap-1 apart, inside p-1 padding. */
const toolbarWidth = (buttons: number) => `${buttons * 2.25 + (buttons - 1) * 0.25 + 0.5}rem`;
/** Read later, translate, open source, share. */
const EXPANDED_READER_TOOLBAR_WIDTH = toolbarWidth(4);
/** Read later, open source. */
const COLLAPSED_READER_TOOLBAR_WIDTH = toolbarWidth(2);
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
  if (props.variant === "navigation") {
    return (
      <nav
        aria-label="Article navigation"
        className="relative flex h-11 w-21 shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full bg-muted-solid p-1 text-muted-foreground [&>*]:relative"
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Previous article"
                className="size-9"
                disabled={!props.canSelectPreviousItem}
                shape="pill"
                size="icon-lg"
                variant="ghost-muted"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  props.onSelectPreviousItem();
                }}
              />
            }
          >
            <ChevronUpIcon className="size-4" />
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
                className="size-9"
                disabled={!props.canSelectNextItem}
                shape="pill"
                size="icon-lg"
                variant="ghost-muted"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  props.onSelectNextItem();
                }}
              />
            }
          >
            <ChevronDownIcon className="size-4" />
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
    <div
      className="relative inline-flex h-11 min-w-0 shrink-0 origin-left items-center overflow-hidden rounded-full bg-muted-solid p-1 font-medium text-base text-muted-foreground [&>*]:relative"
      style={{
        width: props.collapsed ? COLLAPSED_READER_TOOLBAR_WIDTH : EXPANDED_READER_TOOLBAR_WIDTH,
      }}
    >
      <ReaderToolbarRoot
        {...props.toolbar.toolbarProps}
        controlSize="large"
        hideFontControls
        readerFocusVariant={props.collapsed ? "compact" : "full"}
        tooltipCollisionAvoidance={props.tooltipCollisionAvoidance}
        tooltipSide={props.tooltipSide}
      />
    </div>
  );
}
