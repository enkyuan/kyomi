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
import type { ReaderContentWidth, ReaderPreferences } from "@lib/reader-preferences";
import { cn } from "@lib/utils";

type ReaderToolbarProps = {
  isSaved: boolean;
  activeMode: "original" | "extracted";
  extractedAvailable: boolean;
  preferences: ReaderPreferences;
  limits: {
    minFontSizePx: number;
    maxFontSizePx: number;
  };
  onToggleSaved: () => void;
  onModeChange: (mode: "original" | "extracted") => void;
  onCycleContentWidth: () => void;
  onAdjustFontSize: (delta: number) => void;
  onOpenOriginal: () => void;
  onOpenAi: () => void;
};

const CONTENT_WIDTH_LABELS: Record<ReaderContentWidth, string> = {
  narrow: "Narrow width",
  wide: "Wide width",
};

export function ReaderToolbar({
  isSaved,
  activeMode,
  extractedAvailable,
  preferences,
  limits,
  onToggleSaved,
  onModeChange,
  onCycleContentWidth,
  onAdjustFontSize,
  onOpenOriginal,
  onOpenAi,
}: ReaderToolbarProps) {
  const canDecreaseFont = preferences.fontSizePx > limits.minFontSizePx;
  const canIncreaseFont = preferences.fontSizePx < limits.maxFontSizePx;
  const effectiveContentWidth = preferences.contentWidth === "narrow" ? "narrow" : "wide";

  return (
    <Toolbar
      aria-label="Reader tools"
      className="min-w-0 border-0 bg-transparent p-0 text-muted-foreground shadow-none"
    >
      <ToolbarGroup className="min-w-0 gap-0.5">
        <ReaderToolbarButton
          label={isSaved ? "Remove from read later" : "Read later"}
          active={isSaved}
          onClick={onToggleSaved}
        >
          {isSaved ? <StarFill /> : <StarLine />}
        </ReaderToolbarButton>
        <ReaderToolbarButton
          label={activeMode === "original" ? "Showing original source" : "Showing extracted source"}
          active={activeMode === "extracted"}
          disabled={!extractedAvailable}
          onClick={() => onModeChange(activeMode === "original" ? "extracted" : "original")}
        >
          {activeMode === "extracted" ? <TextFill /> : <TextLine />}
        </ReaderToolbarButton>
        <ReaderToolbarButton
          label={`Content width: ${CONTENT_WIDTH_LABELS[effectiveContentWidth]}`}
          onClick={onCycleContentWidth}
        >
          {effectiveContentWidth === "narrow" ? <SquareLine /> : <RectangleLine />}
        </ReaderToolbarButton>
      </ToolbarGroup>
      <ToolbarGroup className="gap-0 rounded-md bg-accent/50 p-0.5">
        <ReaderToolbarButton
          label="Decrease font size"
          disabled={!canDecreaseFont}
          onClick={() => onAdjustFontSize(-1)}
        >
          <MinimizeLine />
        </ReaderToolbarButton>
        <ReaderToolbarButton
          label="Increase font size"
          disabled={!canIncreaseFont}
          onClick={() => onAdjustFontSize(1)}
        >
          <AddLine />
        </ReaderToolbarButton>
      </ToolbarGroup>
      <ToolbarSeparator
        className="mx-1 hidden h-4 w-px bg-border/70 sm:block"
        orientation="vertical"
      />
      <ToolbarGroup className="gap-0.5">
        <ReaderToolbarButton label="Open original article" onClick={onOpenOriginal}>
          <ExternalLinkLine />
        </ReaderToolbarButton>
        <ReaderToolbarButton label="Distill this article" onClick={onOpenAi}>
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
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
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
                  "size-7 rounded-md text-muted-foreground transition-[color,background-color,transform] hover:text-foreground data-[pressed]:text-foreground",
                  active && "bg-accent/50 text-foreground",
                  className,
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
