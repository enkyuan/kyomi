"use client";

import type { CSSProperties, SyntheticEvent } from "react";
import { BookmarkFill, BookmarkLine, ShareForwardLine } from "@kyomi/ui/icons/mingcute";
import { Toolbar as ToolbarRoot, ToolbarGroup } from "@kyomi/ui/components/toolbar";
import { cn } from "@kyomi/ui/lib/utils";
import type { AnchoredToolbarAction, ToolbarSide } from "@modules/articles/lib/actions";
import { ItemToolbarButton } from "./button";
import { ItemToolbarMenu } from "./menu";

export type ItemToolbarProps = {
  isSaved: boolean;
  onCopyLink: (anchor?: HTMLButtonElement) => void;
  onHide: () => void;
  onOpenSource: (anchor?: HTMLButtonElement) => void;
  onReportBrokenArticle: () => void;
  onShareArticle: (anchor?: HTMLButtonElement) => void;
  onToggleSaved: AnchoredToolbarAction;
  className?: string;
  style?: CSSProperties;
};

const INBOX_ITEM_TOOLBAR_BASE_CLASS = "justify-end gap-0 transition-opacity duration-150";
const TOOLBAR_ICON_CLASS = "size-5";
const ITEM_TOOLBAR_TOOLTIP_SIDE: ToolbarSide = "top";
const ITEM_TOOLBAR_TOOLTIP_SIDE_OFFSET = 6;

function stopToolbarPropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

export function ItemToolbar({
  className,
  style,
  isSaved,
  onCopyLink,
  onHide,
  onOpenSource,
  onReportBrokenArticle,
  onShareArticle,
  onToggleSaved,
}: ItemToolbarProps) {
  return (
    <ToolbarRoot
      className={cn(INBOX_ITEM_TOOLBAR_BASE_CLASS, className)}
      style={style}
      variant="ghost"
      onClick={stopToolbarPropagation}
      onPointerDown={stopToolbarPropagation}
    >
      <ToolbarGroup className="justify-end gap-1">
        <ItemToolbarButton
          label={isSaved ? "Remove from read later" : "Read later"}
          active={isSaved}
          className={isSaved ? "text-mizu" : undefined}
          onClick={(anchor) =>
            onToggleSaved({
              anchor,
              side: ITEM_TOOLBAR_TOOLTIP_SIDE,
              sideOffset: ITEM_TOOLBAR_TOOLTIP_SIDE_OFFSET,
            })
          }
        >
          {isSaved ? (
            <BookmarkFill className={TOOLBAR_ICON_CLASS} />
          ) : (
            <BookmarkLine className={TOOLBAR_ICON_CLASS} />
          )}
        </ItemToolbarButton>
        <ItemToolbarButton label="Copy link" copyFeedback onClick={onCopyLink} />
        <ItemToolbarButton label="Share article" onClick={onShareArticle}>
          <ShareForwardLine className={TOOLBAR_ICON_CLASS} />
        </ItemToolbarButton>
        <ItemToolbarMenu
          onHide={onHide}
          onOpenSource={onOpenSource}
          onReportBrokenArticle={onReportBrokenArticle}
        />
      </ToolbarGroup>
    </ToolbarRoot>
  );
}
