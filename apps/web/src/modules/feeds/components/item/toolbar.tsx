"use client";

import type React from "react";
import { useLayoutEffect, useRef, useState } from "react";
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
const TOOLBAR_OVERLAY_TRANSFORM = "translateX(-100%)";
const TOOLBAR_POSITION_SYNC_FRAMES = 8;
const TOOLBAR_RIGHT_INSET_PX = 12;
const TOOLBAR_TOP_OFFSET_PX = -8;
const TOOLBAR_ABOVE_HEADER_LAYER_CLASS = "z-[60]";

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
};

type ToolbarOverlayPosition = {
  top: number;
  left: number;
  isVisible: boolean;
};

function readToolbarOverlayPosition(
  anchor: HTMLElement,
  header: HTMLElement | null,
): ToolbarOverlayPosition {
  const rect = anchor.getBoundingClientRect();
  const headerBottom = header?.getBoundingClientRect().bottom ?? null;
  const top = rect.top + TOOLBAR_TOP_OFFSET_PX;
  const isVisible = headerBottom === null || rect.top >= headerBottom;

  return {
    top,
    left: rect.right - TOOLBAR_RIGHT_INSET_PX,
    isVisible,
  };
}

function areToolbarPositionsEqual(
  previous: ToolbarOverlayPosition | null,
  next: ToolbarOverlayPosition,
) {
  return (
    previous?.top === next.top &&
    previous.left === next.left &&
    previous.isVisible === next.isVisible
  );
}

function useToolbarOverlayPosition({
  anchorElement,
  headerElement,
  viewportElement,
  syncWhileVisible,
}: {
  anchorElement: HTMLElement;
  headerElement: HTMLElement | null;
  viewportElement: HTMLElement | null;
  syncWhileVisible: boolean;
}) {
  const [position, setPosition] = useState<ToolbarOverlayPosition | null>(null);
  const updatePositionRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const updatePosition = () => {
      if (!anchorElement.isConnected) {
        setPosition(null);
        return;
      }

      const nextPosition = readToolbarOverlayPosition(anchorElement, headerElement);
      setPosition((previous) =>
        areToolbarPositionsEqual(previous, nextPosition) ? previous : nextPosition,
      );
    };

    updatePositionRef.current = updatePosition;
    updatePosition();

    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(anchorElement);
    headerElement && resizeObserver.observe(headerElement);
    viewportElement?.addEventListener("scroll", updatePosition, { passive: true });
    window.addEventListener("resize", updatePosition);

    return () => {
      resizeObserver.disconnect();
      viewportElement?.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchorElement, headerElement, viewportElement]);

  useLayoutEffect(() => {
    if (!syncWhileVisible) {
      return;
    }

    let frame = 0;
    let frameId: number | null = null;

    const syncPosition = () => {
      updatePositionRef.current();
      frame += 1;
      if (frame < TOOLBAR_POSITION_SYNC_FRAMES) {
        frameId = window.requestAnimationFrame(syncPosition);
      }
    };

    frameId = window.requestAnimationFrame(syncPosition);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [syncWhileVisible]);

  return position;
}

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
  const position = useToolbarOverlayPosition({
    anchorElement: activeToolbar.anchorElement,
    headerElement,
    viewportElement,
    syncWhileVisible: true,
  });

  if (!position?.isVisible || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <Toolbar
      {...toolbar.toolbarProps}
      toolbarRef={toolbarRef}
      onToolbarPointerLeave={onToolbarPointerLeave}
      className={cn(
        "!fixed !border !border-border/80",
        TOOLBAR_ABOVE_HEADER_LAYER_CLASS,
        "pointer-events-auto opacity-100",
      )}
      style={{
        top: position.top,
        left: position.left,
        transform: TOOLBAR_OVERLAY_TRANSFORM,
      }}
    />,
    document.body,
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
