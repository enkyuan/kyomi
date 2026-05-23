"use client";

import type React from "react";
import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ExternalLinkLine,
  EyeLine,
  MailFill,
  MailOpenLine,
  StarFill,
  StarLine,
} from "@mingcute/react";
import { Button } from "@vols.rss/ui/button";
import { Toolbar as ToolbarRoot, ToolbarButton, ToolbarGroup } from "@vols.rss/ui/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@vols.rss/ui/tooltip";
import {
  useInboxItemStateMutation,
  type InboxItemPatch,
} from "@modules/inbox/hooks/use-inbox-item-state-mutation";
import { type InboxFilter, type InboxItem } from "@modules/inbox/services/api";
import { cn } from "@lib/utils";

const INBOX_ITEM_TOOLBAR_BASE_CLASS =
  "gap-0 rounded-lg border border-border/80 bg-popover/95 p-0.5 text-popover-foreground shadow-md/10 transition-opacity duration-150";
const TOOLBAR_RIGHT_INSET_PX = 12;
const TOOLBAR_TOP_OFFSET_PX = -8;

type ToolbarProps = {
  filter: InboxFilter;
  toolbarRef?: React.RefObject<HTMLDivElement | null>;
  onToolbarPointerLeave?: (event: React.PointerEvent<HTMLDivElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  isRead: boolean;
  isSaved: boolean;
  onHide: () => void;
  onMarkRead: () => void;
  onOpenSource: () => void;
  onToggleSaved: () => void;
};

export type ToolbarModel = {
  toolbarProps: ToolbarProps;
};

export type ActiveToolbar = {
  item: InboxItem;
  anchorElement: HTMLElement;
  toolbarHostElement: HTMLElement;
};

export function Toolbar({
  filter,
  toolbarRef,
  onToolbarPointerLeave,
  className,
  style,
  isRead,
  isSaved,
  onHide,
  onMarkRead,
  onOpenSource,
  onToggleSaved,
}: ToolbarProps) {
  const readLabel =
    filter === "recent" ? "Mark as unread" : isRead ? "Already read" : "Mark as read";

  return (
    <ToolbarRoot
      ref={toolbarRef}
      onPointerLeave={onToolbarPointerLeave}
      className={cn(INBOX_ITEM_TOOLBAR_BASE_CLASS, className)}
      style={style}
    >
      <ToolbarGroup className="gap-0">
        <ToolbarButtonControl
          label={isSaved ? "Remove from read later" : "Read later"}
          onClick={onToggleSaved}
          active={isSaved}
        >
          {isSaved ? <StarFill /> : <StarLine />}
        </ToolbarButtonControl>
        <ToolbarButtonControl label="Open source article" onClick={onOpenSource}>
          <ExternalLinkLine />
        </ToolbarButtonControl>
        <ToolbarButtonControl label="Hide from inbox" onClick={onHide}>
          <EyeLine />
        </ToolbarButtonControl>
        <ToolbarButtonControl
          label={readLabel}
          onClick={onMarkRead}
          active={isRead}
          disabled={isRead && filter !== "recent"}
        >
          <ReadStateIcon isRead={isRead} />
        </ToolbarButtonControl>
      </ToolbarGroup>
    </ToolbarRoot>
  );
}

function ActiveToolbarOverlay({
  activeToolbar,
  filter,
  headerElement,
  viewportElement,
  toolbarRef,
  onToolbarPointerLeave,
}: {
  activeToolbar: ActiveToolbar;
  filter: InboxFilter;
  headerElement: HTMLElement | null;
  viewportElement: HTMLElement | null;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
  onToolbarPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const toolbar = useToolbarModel({ filter, item: activeToolbar.item });
  const isUnderHeader = useToolbarUnderHeader({
    anchorElement: activeToolbar.anchorElement,
    headerElement,
    viewportElement,
  });

  if (
    !activeToolbar.anchorElement.isConnected ||
    !activeToolbar.toolbarHostElement.isConnected ||
    typeof document === "undefined"
  ) {
    return null;
  }

  const anchorRect = activeToolbar.anchorElement.getBoundingClientRect();
  const hostRect = activeToolbar.toolbarHostElement.getBoundingClientRect();
  const top = anchorRect.top - hostRect.top + TOOLBAR_TOP_OFFSET_PX;

  return createPortal(
    <Toolbar
      {...toolbar.toolbarProps}
      toolbarRef={toolbarRef}
      onToolbarPointerLeave={onToolbarPointerLeave}
      className={cn(
        "absolute! border! border-border/80!",
        isUnderHeader ? "z-20" : "z-60",
        "pointer-events-auto opacity-100",
      )}
      style={{
        top: `${top}px`,
        right: `${TOOLBAR_RIGHT_INSET_PX}px`,
      }}
    />,
    activeToolbar.toolbarHostElement,
  );
}

export function ToolbarOverlay({
  activeToolbar,
  filter,
  headerElement,
  viewportElement,
  toolbarRef,
  onToolbarPointerLeave,
}: {
  activeToolbar: ActiveToolbar | null;
  filter: InboxFilter;
  headerElement: HTMLElement | null;
  viewportElement: HTMLElement | null;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
  onToolbarPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  if (!activeToolbar) {
    return null;
  }

  return (
    <ActiveToolbarOverlay
      activeToolbar={activeToolbar}
      filter={filter}
      headerElement={headerElement}
      viewportElement={viewportElement}
      toolbarRef={toolbarRef}
      onToolbarPointerLeave={onToolbarPointerLeave}
    />
  );
}

function readIsToolbarUnderHeader(
  anchor: HTMLElement,
  header: HTMLElement | null,
  viewport: HTMLElement | null,
) {
  if (!header || !viewport || viewport.scrollTop <= 0) {
    return false;
  }

  return anchor.getBoundingClientRect().top <= header.getBoundingClientRect().bottom;
}

function useToolbarUnderHeader({
  anchorElement,
  headerElement,
  viewportElement,
}: {
  anchorElement: HTMLElement;
  headerElement: HTMLElement | null;
  viewportElement: HTMLElement | null;
}) {
  const [isUnderHeader, setIsUnderHeader] = useState(() =>
    readIsToolbarUnderHeader(anchorElement, headerElement, viewportElement),
  );

  useLayoutEffect(() => {
    const update = () => {
      if (!anchorElement.isConnected) {
        return;
      }

      setIsUnderHeader((previous) => {
        const next = readIsToolbarUnderHeader(anchorElement, headerElement, viewportElement);
        return previous === next ? previous : next;
      });
    };

    update();

    viewportElement?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      viewportElement?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [anchorElement, headerElement, viewportElement]);

  return isUnderHeader;
}

export function useToolbarModel({
  filter,
  item,
}: {
  filter: InboxFilter;
  item: InboxItem;
}): ToolbarModel {
  const updateItemMutation = useInboxItemStateMutation();

  const updateItem = (patch: InboxItemPatch, removeFromList = false) => {
    updateItemMutation.mutate({ itemId: item.id, patch, removeFromList });
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
          isRead ? "scale-25 opacity-0 blur-xs" : "scale-100 opacity-100 blur-0",
        )}
      >
        <MailOpenLine />
      </span>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-[opacity,transform,filter] duration-300 ease-[cubic-bezier(0.2,0,0,1)] will-change-[opacity,transform,filter]",
          isRead ? "scale-100 opacity-100 blur-0" : "scale-25 opacity-0 blur-xs",
        )}
      >
        <MailFill />
      </span>
    </span>
  );
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
