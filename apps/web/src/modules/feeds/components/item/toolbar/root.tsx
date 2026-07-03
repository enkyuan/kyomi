"use client";

import type { SyntheticEvent } from "react";
import {
  BookmarkFill,
  BookmarkLine,
  ExternalLinkLine,
  HeadAiLine,
  ShareForwardLine,
} from "@mingcute/react";
import { Toolbar as ToolbarRoot, ToolbarGroup, ToolbarSeparator } from "@kyomi/ui/toolbar";
import { cn } from "@kyomi/ui/lib/utils";
import type { ItemToolbarProps } from "@modules/toolbar/lib/types";
import { ItemToolbarButton } from "./button";
import { ItemToolbarMenu } from "./menu";

const INBOX_ITEM_TOOLBAR_BASE_CLASS =
  "justify-end gap-0 rounded-lg border border-border/80 bg-popover/95 p-0.5 text-popover-foreground shadow-md/10 transition-opacity duration-150";
const TOOLBAR_ICON_CLASS = "size-5";

function stopToolbarPropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

export function ItemToolbar({
  className,
  style,
  isSaved,
  onOpenAi,
  onCopyLink,
  onHide,
  onOpenSource,
  onReportBrokenArticle,
  onShareArticle,
  onToggleSaved,
  presentation = "row",
}: ItemToolbarProps) {
  const isArticleHeader = presentation === "articleHeader";
  const buttonClassName = isArticleHeader ? "rounded-full" : undefined;

  return (
    <ToolbarRoot
      className={cn(INBOX_ITEM_TOOLBAR_BASE_CLASS, className)}
      style={style}
      onClick={stopToolbarPropagation}
      onPointerDown={stopToolbarPropagation}
    >
      <ToolbarGroup className="justify-end gap-1">
        <ItemToolbarButton
          label={isSaved ? "Remove from read later" : "Read later"}
          onClick={onToggleSaved}
          active={isSaved}
          className={cn(buttonClassName, isSaved && "text-mizu")}
        >
          {isSaved ? (
            <BookmarkFill className={TOOLBAR_ICON_CLASS} />
          ) : (
            <BookmarkLine className={TOOLBAR_ICON_CLASS} />
          )}
        </ItemToolbarButton>
        <ItemToolbarButton
          label="Copy link"
          onClick={onCopyLink}
          className={buttonClassName}
          copyFeedback
        />
        {isArticleHeader ? (
          <>
            <ItemToolbarButton
              label="Open source"
              onClick={onOpenSource}
              className={buttonClassName}
            >
              <ExternalLinkLine className={TOOLBAR_ICON_CLASS} />
            </ItemToolbarButton>
            <ToolbarSeparator
              orientation="vertical"
              className="mx-1 h-8 self-center bg-border/70 data-[orientation=vertical]:my-0"
            />
            {onOpenAi ? (
              <ItemToolbarButton
                label="Distill this article"
                onClick={onOpenAi}
                className={buttonClassName}
              >
                <HeadAiLine className={TOOLBAR_ICON_CLASS} />
              </ItemToolbarButton>
            ) : null}
            <ItemToolbarButton
              label="Share article"
              onClick={onShareArticle}
              className={buttonClassName}
            >
              <ShareForwardLine className={TOOLBAR_ICON_CLASS} />
            </ItemToolbarButton>
          </>
        ) : (
          <>
            <ItemToolbarButton label="Share article" onClick={onShareArticle}>
              <ShareForwardLine className={TOOLBAR_ICON_CLASS} />
            </ItemToolbarButton>
            <ItemToolbarMenu
              onHide={onHide}
              onOpenSource={onOpenSource}
              onReportBrokenArticle={onReportBrokenArticle}
            />
          </>
        )}
      </ToolbarGroup>
    </ToolbarRoot>
  );
}
