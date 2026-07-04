"use client";

import type { ReactNode } from "react";
import { Button } from "@kyomi/ui/button";
import { CopyIcon } from "@kyomi/ui/icons/copy";
import { ToolbarButton } from "@kyomi/ui/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/tooltip";
import { useFeedback } from "@hooks/use-feedback";
import { cn } from "@kyomi/ui/lib/utils";

const TOOLBAR_ICON_CLASS = "size-5";
const TOOLBAR_TOOLTIP_SIDE_OFFSET = 6;

export function ItemToolbarButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
  className,
  copyFeedback = false,
}: {
  label: string;
  children?: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  copyFeedback?: boolean;
}) {
  const { isActive: isCopied, showFeedback } = useFeedback();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ToolbarButton
            aria-label={label}
            render={
              <Button
                className={cn(
                  "size-10 rounded-xl text-muted-foreground hover:text-foreground sm:size-9",
                  active && "text-foreground",
                  className,
                )}
                disabled={disabled}
                size="icon-lg"
                variant="ghost"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onClick();
                  if (copyFeedback) {
                    showFeedback();
                  }
                }}
              />
            }
          >
            {copyFeedback ? (
              <CopyIcon isCopied={isCopied} className={TOOLBAR_ICON_CLASS} />
            ) : (
              children
            )}
          </ToolbarButton>
        }
      />
      <TooltipPopup sideOffset={TOOLBAR_TOOLTIP_SIDE_OFFSET}>{label}</TooltipPopup>
    </Tooltip>
  );
}
