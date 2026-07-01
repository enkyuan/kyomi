"use client";

import type React from "react";
import { ExternalLinkLine, StarFill, StarLine } from "@mingcute/react";
import { Button } from "@kyomi/ui/button";
import { Toolbar as ToolbarRoot, ToolbarButton, ToolbarGroup } from "@kyomi/ui/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/tooltip";
import {
  useInboxItemStateMutation,
  type InboxItemPatch,
} from "@modules/inbox/hooks/use-inbox-data";
import { type InboxItem } from "@modules/inbox/services/api";
import { cn } from "@lib/utils";

const INBOX_ITEM_TOOLBAR_BASE_CLASS =
  "gap-0 rounded-lg border border-border/80 bg-popover/95 p-0.5 text-popover-foreground shadow-md/10 transition-opacity duration-150";
const TOOLBAR_ICON_CLASS = "size-5";

type ToolbarProps = {
  className?: string;
  style?: React.CSSProperties;
  isSaved: boolean;
  onOpenSource: () => void;
  onToggleSaved: () => void;
};

export type ToolbarModel = {
  toolbarProps: ToolbarProps;
};

export function ItemInlineToolbar({ item, className }: { item: InboxItem; className?: string }) {
  const toolbar = useToolbarModel({ item });

  return (
    <Toolbar
      {...toolbar.toolbarProps}
      className={cn(
        "border-0 bg-transparent p-0 text-muted-foreground shadow-none",
        "group-hover/inbox-item:text-muted-foreground/95 group-focus-within/inbox-item:text-muted-foreground/95",
        className,
      )}
    />
  );
}

function Toolbar({ className, style, isSaved, onOpenSource, onToggleSaved }: ToolbarProps) {
  return (
    <ToolbarRoot className={cn(INBOX_ITEM_TOOLBAR_BASE_CLASS, className)} style={style}>
      <ToolbarGroup className="gap-1">
        <ToolbarButtonControl
          label={isSaved ? "Remove from read later" : "Read later"}
          onClick={onToggleSaved}
          active={isSaved}
        >
          {isSaved ? (
            <StarFill className={TOOLBAR_ICON_CLASS} />
          ) : (
            <StarLine className={TOOLBAR_ICON_CLASS} />
          )}
        </ToolbarButtonControl>
        <ToolbarButtonControl label="Open source article" onClick={onOpenSource}>
          <ExternalLinkLine className={TOOLBAR_ICON_CLASS} />
        </ToolbarButtonControl>
      </ToolbarGroup>
    </ToolbarRoot>
  );
}

export function useToolbarModel({ item }: { item: InboxItem }): ToolbarModel {
  const updateItemMutation = useInboxItemStateMutation();

  const updateItem = (patch: InboxItemPatch, removeFromList = false) => {
    updateItemMutation.mutate({ itemId: item.id, patch, removeFromList });
  };

  return {
    toolbarProps: {
      isSaved: item.isSaved,
      onOpenSource: () => window.open(item.link, "_blank", "noopener,noreferrer"),
      onToggleSaved: () => updateItem({ isSaved: !item.isSaved }),
    },
  };
}

function ToolbarButtonControl({
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
                  "size-10 rounded-xl text-muted-foreground hover:text-foreground sm:size-9",
                  active && "text-foreground",
                )}
                disabled={disabled}
                size="icon-lg"
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
