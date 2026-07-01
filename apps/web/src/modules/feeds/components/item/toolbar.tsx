"use client";

import { useState, type CSSProperties, type ReactNode, type SyntheticEvent } from "react";
import {
  BookmarkFill,
  BookmarkLine,
  ExternalLinkLine,
  EyeCloseLine,
  HeadAiLine,
  More2Line,
  ReportLine,
  ShareForwardLine,
} from "@mingcute/react";
import { Button } from "@kyomi/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@kyomi/ui/menu";
import {
  Toolbar as ToolbarRoot,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from "@kyomi/ui/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/tooltip";
import {
  useInboxItemStateMutation,
  type InboxItemPatch,
} from "@modules/inbox/hooks/use-inbox-data";
import { type InboxItem } from "@modules/inbox/services/api";
import { CopyFeedbackIcon, useCopyFeedback } from "@lib/copy-feedback-icon";
import { SAVED_ACTION_ACTIVE_CLASS } from "@lib/theme/action-colors";
import { cn } from "@lib/utils";
import { BrokenArticleReportDialog } from "./broken-article-report-dialog";

const INBOX_ITEM_TOOLBAR_BASE_CLASS =
  "justify-end gap-0 rounded-lg border border-border/80 bg-popover/95 p-0.5 text-popover-foreground shadow-md/10 transition-opacity duration-150";
const TOOLBAR_ICON_CLASS = "size-5";

function stopToolbarPropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

type ToolbarProps = {
  className?: string;
  style?: CSSProperties;
  isSaved: boolean;
  onOpenAi?: () => void;
  onCopyLink: () => void;
  onHide: () => void;
  onOpenSource: () => void;
  onReportBrokenArticle: () => void;
  onShareArticle: () => void;
  onToggleSaved: () => void;
  presentation?: "row" | "articleHeader";
};

export type ToolbarModel = {
  toolbarProps: ToolbarProps;
};

export function ItemInlineToolbar({ item, className }: { item: InboxItem; className?: string }) {
  const [reportOpen, setReportOpen] = useState(false);
  const toolbar = useToolbarModel({
    item,
    onReportBrokenArticle: () => setReportOpen(true),
  });

  return (
    <>
      <Toolbar
        {...toolbar.toolbarProps}
        className={cn(
          "border-0 bg-transparent p-0 text-muted-foreground shadow-none",
          className,
        )}
      />
      <BrokenArticleReportDialog item={item} open={reportOpen} onOpenChange={setReportOpen} />
    </>
  );
}

export function Toolbar({
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
}: ToolbarProps) {
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
        <ToolbarButtonControl
          label={isSaved ? "Remove from read later" : "Read later"}
          onClick={onToggleSaved}
          active={isSaved}
          className={cn(buttonClassName, isSaved && SAVED_ACTION_ACTIVE_CLASS)}
        >
          {isSaved ? (
            <BookmarkFill className={TOOLBAR_ICON_CLASS} />
          ) : (
            <BookmarkLine className={TOOLBAR_ICON_CLASS} />
          )}
        </ToolbarButtonControl>
        <ToolbarButtonControl
          label="Copy link"
          onClick={onCopyLink}
          className={buttonClassName}
          copyFeedback
        />
        {isArticleHeader ? (
          <>
            <ToolbarButtonControl
              label="Open source"
              onClick={onOpenSource}
              className={buttonClassName}
            >
              <ExternalLinkLine className={TOOLBAR_ICON_CLASS} />
            </ToolbarButtonControl>
            <ToolbarSeparator
              orientation="vertical"
              className="mx-1 h-8 self-center bg-border/70 data-[orientation=vertical]:my-0"
            />
            {onOpenAi ? (
              <ToolbarButtonControl
                label="Distill this article"
                onClick={onOpenAi}
                className={buttonClassName}
              >
                <HeadAiLine className={TOOLBAR_ICON_CLASS} />
              </ToolbarButtonControl>
            ) : null}
            <ToolbarButtonControl
              label="Share article"
              onClick={onShareArticle}
              className={buttonClassName}
            >
              <ShareForwardLine className={TOOLBAR_ICON_CLASS} />
            </ToolbarButtonControl>
          </>
        ) : (
          <>
            <ToolbarButtonControl label="Share article" onClick={onShareArticle}>
              <ShareForwardLine className={TOOLBAR_ICON_CLASS} />
            </ToolbarButtonControl>
            <ToolbarMenuControl
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

export function useToolbarModel({
  item,
  onReportBrokenArticle,
}: {
  item: InboxItem;
  onReportBrokenArticle?: () => void;
}): ToolbarModel {
  const updateItemMutation = useInboxItemStateMutation();

  const updateItem = (patch: InboxItemPatch, removeFromList = false) => {
    updateItemMutation.mutate({ itemId: item.id, patch, removeFromList });
  };

  return {
    toolbarProps: {
      isSaved: item.isSaved,
      onCopyLink: () => {
        void copyTextToClipboard(item.link).catch(() => undefined);
      },
      onHide: () => updateItem({ isHidden: true }, true),
      onOpenSource: () => {
        window.open(item.link, "_blank", "noopener,noreferrer");
      },
      onReportBrokenArticle: () => {
        onReportBrokenArticle?.();
      },
      onShareArticle: () => {
        void shareArticle(item).catch(() => undefined);
      },
      onToggleSaved: () => updateItem({ isSaved: !item.isSaved }),
    },
  };
}

async function shareArticle(item: InboxItem) {
  const shareData: ShareData = {
    title: item.title,
    text: item.summary ?? item.feedTitle,
    url: item.link,
  };

  if (navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
    await navigator.share(shareData);
    return;
  }

  await copyTextToClipboard(item.link);
}

async function copyTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // Fall back to the legacy copy path below.
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  textarea.style.position = "fixed";
  textarea.style.top = "0";

  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function ToolbarMenuControl({
  onHide,
  onOpenSource,
  onReportBrokenArticle,
}: {
  onHide: () => void;
  onOpenSource: () => void;
  onReportBrokenArticle: () => void;
}) {
  return (
    <Menu>
      <Tooltip>
        <TooltipTrigger
          render={
            <MenuTrigger
              render={
                <ToolbarButton
                  aria-label="More"
                  render={
                    <Button
                      className="size-10 rounded-xl text-muted-foreground hover:text-foreground sm:size-9"
                      size="icon-lg"
                      variant="ghost"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    />
                  }
                >
                  <More2Line className={TOOLBAR_ICON_CLASS} />
                </ToolbarButton>
              }
            />
          }
        />
        <TooltipPopup sideOffset={8}>More</TooltipPopup>
      </Tooltip>
      <MenuPopup
        align="end"
        sideOffset={8}
        className="min-w-48 rounded-xl p-1 before:rounded-[11px]"
      >
        <ToolbarMenuItem label="Open source" onClick={onOpenSource}>
          <ExternalLinkLine />
        </ToolbarMenuItem>
        <ToolbarMenuItem label="Not interested" onClick={onHide}>
          <EyeCloseLine />
        </ToolbarMenuItem>
        <ToolbarMenuItem label="Report broken article" onClick={onReportBrokenArticle}>
          <ReportLine />
        </ToolbarMenuItem>
      </MenuPopup>
    </Menu>
  );
}

function ToolbarMenuItem({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <MenuItem
      className="rounded-lg"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
      <span>{label}</span>
    </MenuItem>
  );
}

function ToolbarButtonControl({
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
              <CopyFeedbackIcon isCopied={isCopied} className={TOOLBAR_ICON_CLASS} />
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
