"use client";

import { DownFill, UpFill } from "@mingcute/react";
import { Button } from "@kyomi/ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/tooltip";

const READER_HEADER_TOOLTIP_SIDE = "bottom";
const READER_HEADER_TOOLTIP_SIDE_OFFSET = 8;
const READER_HEADER_TOOLTIP_COLLISION_AVOIDANCE = {
  side: "shift",
  align: "shift",
  fallbackAxisSide: "none",
} as const;

export function StepControls({
  canSelectPreviousItem,
  canSelectNextItem,
  onSelectPreviousItem,
  onSelectNextItem,
}: {
  canSelectPreviousItem: boolean;
  canSelectNextItem: boolean;
  onSelectPreviousItem: () => void;
  onSelectNextItem: () => void;
}) {
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
              disabled={!canSelectPreviousItem}
              size="icon-lg"
              variant="ghost"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelectPreviousItem();
              }}
            />
          }
        >
          <UpFill className="size-4" />
        </TooltipTrigger>
        <TooltipPopup
          collisionAvoidance={READER_HEADER_TOOLTIP_COLLISION_AVOIDANCE}
          side={READER_HEADER_TOOLTIP_SIDE}
          sideOffset={READER_HEADER_TOOLTIP_SIDE_OFFSET}
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
              disabled={!canSelectNextItem}
              size="icon-lg"
              variant="ghost"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelectNextItem();
              }}
            />
          }
        >
          <DownFill className="size-4" />
        </TooltipTrigger>
        <TooltipPopup
          collisionAvoidance={READER_HEADER_TOOLTIP_COLLISION_AVOIDANCE}
          side={READER_HEADER_TOOLTIP_SIDE}
          sideOffset={READER_HEADER_TOOLTIP_SIDE_OFFSET}
        >
          Next article
        </TooltipPopup>
      </Tooltip>
    </nav>
  );
}
