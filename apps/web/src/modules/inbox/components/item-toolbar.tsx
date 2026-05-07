"use client";

import type React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLinkLine,
  EyeLine,
  MailFill,
  MailOpenLine,
  StarFill,
  StarLine,
} from "@mingcute/react";
import { Button } from "@components/ui/button";
import { Toolbar, ToolbarButton, ToolbarGroup } from "@components/ui/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@components/ui/tooltip";
import type { InboxFilter, InboxItem } from "@modules/inbox/api";
import { updateInboxItemState } from "@modules/inbox/api";
import { updateInboxItemCaches } from "@modules/inbox/lib/cache";
import { cn } from "@lib/utils";

type InboxItemPatch = Partial<Pick<InboxItem, "isRead" | "isSaved">>;

type InboxItemToolbarProps = {
  filter: InboxFilter;
  isRead: boolean;
  isSaved: boolean;
  onHide: () => void;
  onMarkRead: () => void;
  onOpenSource: () => void;
  onToggleSaved: () => void;
};

export type InboxItemToolbarModel = {
  toolbarProps: InboxItemToolbarProps;
};

export function InboxItemToolbar({
  filter,
  isRead,
  isSaved,
  onHide,
  onMarkRead,
  onOpenSource,
  onToggleSaved,
}: InboxItemToolbarProps) {
  const readLabel =
    filter === "recent" ? "Mark as unread" : isRead ? "Already read" : "Mark as read";

  return (
    <Toolbar
      className={cn(
        "pointer-events-auto absolute right-3 z-50 gap-0 rounded-lg border-border/80 bg-popover/95 p-0.5 text-popover-foreground opacity-0 shadow-md/10 transition-opacity duration-150 group-hover/inbox-item:opacity-100 group-focus-within/inbox-item:opacity-100",
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
        <InboxItemToolbarButton label="Open source article" onClick={onOpenSource}>
          <ExternalLinkLine />
        </InboxItemToolbarButton>
        <InboxItemToolbarButton label="Hide from inbox" onClick={onHide}>
          <EyeLine />
        </InboxItemToolbarButton>
        <InboxItemToolbarButton
          label={readLabel}
          onClick={onMarkRead}
          active={isRead}
          disabled={isRead && filter !== "recent"}
        >
          <ReadStateIcon isRead={isRead} />
        </InboxItemToolbarButton>
      </ToolbarGroup>
    </Toolbar>
  );
}

export function useInboxItemToolbarModel({
  filter,
  item,
}: {
  filter: InboxFilter;
  item: InboxItem;
}): InboxItemToolbarModel {
  const queryClient = useQueryClient();
  const updateItemMutation = useMutation({
    mutationFn: (input: { patch: InboxItemPatch; removeFromList?: boolean }) =>
      updateInboxItemState({
        data: {
          itemId: item.id,
          ...input.patch,
        },
      }),
    onMutate: async ({ patch, removeFromList }) => {
      await queryClient.cancelQueries({ queryKey: ["inbox"] });
      updateInboxItemCaches(queryClient, item.id, patch, Boolean(removeFromList));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["inbox", "items"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox", "view-count"] });
      void queryClient.invalidateQueries({ queryKey: ["inbox", "item-detail", item.id] });
      void queryClient.invalidateQueries({ queryKey: ["sidebar", "inbox-summary"] });
    },
  });

  const updateItem = (patch: InboxItemPatch, removeFromList = false) => {
    updateItemMutation.mutate({ patch, removeFromList });
  };

  return {
    toolbarProps: {
      filter,
      isRead: item.isRead,
      isSaved: item.isSaved,
      onHide: () => updateItem({ isRead: true }, true),
      onMarkRead: () =>
        filter === "recent" ? updateItem({ isRead: false }, true) : updateItem({ isRead: true }),
      onOpenSource: () => window.open(item.link, "_blank", "noopener,noreferrer"),
      onToggleSaved: () => updateItem({ isSaved: !item.isSaved }),
    },
  };
}

function ReadStateIcon({ isRead }: { isRead: boolean }) {
  return (
    <span className="relative block size-4.5 sm:size-4" aria-hidden>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)] will-change-[opacity,transform,filter]",
          isRead ? "scale-25 opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-0",
        )}
      >
        <MailOpenLine />
      </span>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)] will-change-[opacity,transform,filter]",
          isRead ? "scale-100 opacity-100 blur-0" : "scale-25 opacity-0 blur-[4px]",
        )}
      >
        <MailFill />
      </span>
    </span>
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
