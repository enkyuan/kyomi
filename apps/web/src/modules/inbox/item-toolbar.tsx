"use client";

import type React from "react";
import { EyeLine, MailOpenFill, MailOpenLine, StarFill, StarLine } from "@mingcute/react";
import { Button } from "@components/ui/button";
import { Toolbar, ToolbarButton, ToolbarGroup } from "@components/ui/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@components/ui/tooltip";
import { cn } from "@lib/utils";

type InboxItemToolbarProps = {
  filter: "inbox" | "today" | "unread" | "saved" | "recent";
  isRead: boolean;
  isSaved: boolean;
  onHide: () => void;
  onMarkRead: () => void;
  onToggleSaved: () => void;
};

export function InboxItemToolbar({
  filter,
  isRead,
  isSaved,
  onHide,
  onMarkRead,
  onToggleSaved,
}: InboxItemToolbarProps) {
  const readLabel =
    filter === "recent" ? "Mark as unread" : isRead ? "Already read" : "Mark as read";

  return (
    <Toolbar
      className={cn(
        "pointer-events-auto absolute right-3 z-50 gap-0 rounded-lg border-border/80 bg-popover/95 p-0.5 text-popover-foreground opacity-0 shadow-md/10 transition-opacity duration-150 group-hover/inbox-item:opacity-100",
        "-top-2",
      )}
    >
      <ToolbarGroup className="gap-0">
        <InboxItemToolbarButton
          label={isSaved ? "Remove from read later" : "Read later"}
          onClick={onToggleSaved}
          active={isSaved}
        >
          {isSaved ? <StarFill /> : <StarLine />}
        </InboxItemToolbarButton>
        <InboxItemToolbarButton label="Hide from inbox" onClick={onHide}>
          <EyeLine />
        </InboxItemToolbarButton>
        <InboxItemToolbarButton label={readLabel} onClick={onMarkRead} active={isRead}>
          {isRead ? <MailOpenFill /> : <MailOpenLine />}
        </InboxItemToolbarButton>
      </ToolbarGroup>
    </Toolbar>
  );
}

function InboxItemToolbarButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <ToolbarButton
            aria-label={label}
            render={
              <Button
                className={cn(
                  "size-7 rounded-md text-muted-foreground hover:text-foreground",
                  active && "text-foreground",
                )}
                disabled={disabled}
                size="icon-xs"
                variant="ghost"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onClick();
                }}
              />
            }
          >
            {children}
          </ToolbarButton>
        }
      />
      <TooltipPopup sideOffset={8}>{label}</TooltipPopup>
    </Tooltip>
  );
}
