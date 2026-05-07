"use client";

import type React from "react";
import {
  AddLine,
  RectangleLine,
  ExternalLinkLine,
  HeadAiLine,
  SquareLine,
  MinimizeLine,
  StarFill,
  StarLine,
  TextFill,
  TextLine,
} from "@mingcute/react";
import { Button } from "@components/ui/button";
import { Toolbar, ToolbarButton, ToolbarGroup, ToolbarSeparator } from "@components/ui/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@components/ui/tooltip";
import type { ReaderContentWidth } from "@lib/reader-preferences";
import { cn } from "@lib/utils";
import type { ReaderToolbarProps } from "./reader-toolbar-model";

const CONTENT_WIDTH_LABELS: Record<ReaderContentWidth, string> = {
  narrow: "Narrow",
  wide: "Wide",
};

export function ReaderToolbar({
  isSaved,
  activeMode,
  extractedAvailable,
  contentWidth,
  canDecreaseFont,
  canIncreaseFont,
  readerFocusMode = false,
  onToggleSaved,
  onToggleMode,
  onCycleContentWidth,
  onDecreaseFontSize,
  onIncreaseFontSize,
  onOpenOriginal,
  onOpenAi,
  variant = "inline",
}: ReaderToolbarProps) {
  const tooltipSideOffset = variant === "floating" ? 10 : 8;

  return (
    <Toolbar
      aria-label="Reader tools"
      className={cn(
        "min-w-0 gap-1 border-0 p-0 text-muted-foreground shadow-none",
        variant === "inline" ? "bg-transparent" : "reader-floating-toolbar rounded-xl px-1.5 py-1",
      )}
    >
      <ToolbarGroup className="min-w-0 gap-1">
        <ReaderToolbarButton
          label={isSaved ? "Remove from read later" : "Read later"}
          active={isSaved}
          onClick={onToggleSaved}
          tooltipSideOffset={tooltipSideOffset}
        >
          {isSaved ? <StarFill /> : <StarLine />}
        </ReaderToolbarButton>
        <ReaderToolbarButton
          label={activeMode === "original" ? "Showing original source" : "Showing extracted source"}
          active={activeMode === "extracted"}
          disabled={!extractedAvailable}
          onClick={onToggleMode}
          tooltipSideOffset={tooltipSideOffset}
        >
          {activeMode === "extracted" ? <TextFill /> : <TextLine />}
        </ReaderToolbarButton>
        {!readerFocusMode ? (
          <ReaderToolbarButton
            label={`Content width: ${CONTENT_WIDTH_LABELS[contentWidth]}`}
            onClick={onCycleContentWidth}
            tooltipSideOffset={tooltipSideOffset}
          >
            {contentWidth === "narrow" ? <SquareLine /> : <RectangleLine />}
          </ReaderToolbarButton>
        ) : null}
      </ToolbarGroup>
      <ToolbarGroup className="gap-1 rounded-md bg-accent/50 p-0.5">
        <ReaderToolbarButton
          label="Decrease font size"
          disabled={!canDecreaseFont}
          onClick={onDecreaseFontSize}
          tooltipSideOffset={tooltipSideOffset}
        >
          <MinimizeLine />
        </ReaderToolbarButton>
        <ReaderToolbarButton
          label="Increase font size"
          disabled={!canIncreaseFont}
          onClick={onIncreaseFontSize}
          tooltipSideOffset={tooltipSideOffset}
        >
          <AddLine />
        </ReaderToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator
        className="mx-0.5 hidden w-px bg-border/70 sm:block"
        orientation="vertical"
      />
      <ToolbarGroup className="gap-1">
        <ReaderToolbarButton
          label="Open source"
          onClick={onOpenOriginal}
          tooltipSideOffset={tooltipSideOffset}
        >
          <ExternalLinkLine />
        </ReaderToolbarButton>
        <ReaderToolbarButton
          label="Distill this article"
          onClick={onOpenAi}
          tooltipSideOffset={tooltipSideOffset}
        >
          <HeadAiLine />
        </ReaderToolbarButton>
      </ToolbarGroup>
    </Toolbar>
  );
}

function ReaderToolbarButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
  className,
  tooltipSideOffset = 8,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  tooltipSideOffset?: number;
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
                  "rounded-md text-muted-foreground transition-[color,background-color,transform] hover:text-foreground data-pressed:text-foreground",
                  active && "bg-accent/50 text-foreground",
                  className,
                )}
                disabled={disabled}
                size="icon-sm"
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
      <TooltipPopup sideOffset={tooltipSideOffset}>{label}</TooltipPopup>
    </Tooltip>
  );
}
