"use client";

import type { ReactNode } from "react";
import { Button } from "@kyomi/ui/button";
import { CopyIcon } from "@kyomi/ui/icons/copy";
import { ToolbarButton } from "@kyomi/ui/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/tooltip";
import { useCopyFeedback } from "@lib/use-copy-feedback";
import { cn } from "@lib/utils";

const TOOLBAR_ICON_CLASS = "size-5";

export function ButtonControl({
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
  const { isCopied, showCopyFeedback } = useCopyFeedback();

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
                    showCopyFeedback();
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
      <TooltipPopup sideOffset={8}>{label}</TooltipPopup>
    </Tooltip>
  );
}
