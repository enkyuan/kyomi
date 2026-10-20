"use client";

import type React from "react";
import {
  AddFill,
  BookmarkFill,
  BookmarkLine,
  RectangleLine,
  ExternalLinkLine,
  ShareForwardLine,
  SquareLine,
  MinimizeFill,
  TextFill,
  TextLine,
  Translate2Line,
} from "@kyomi/ui/icons/mingcute";
import {
  AnimatePresence,
  LazyMotion,
  controlSwapMotion,
  domAnimation,
  m,
  useReducedMotion,
  springTransition,
} from "@kyomi/ui/lib/motion";
import { Button } from "@kyomi/ui/components/button";
import {
  Toolbar as ToolbarRoot,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from "@kyomi/ui/components/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/components/tooltip";
import { useMediaQuery } from "@kyomi/ui/hooks/use-media-query";
import type { ToolbarProps } from "@modules/reader/lib/toolbar";
import type { ReaderContentWidth } from "@modules/reader/lib/preferences";
import { cn } from "@kyomi/ui/lib/utils";
import { FontSizeTicker } from "./font-ticker";

const CONTENT_WIDTH_LABELS: Record<ReaderContentWidth, string> = {
  narrow: "Narrow",
  wide: "Wide",
};

// oxlint-disable-next-line eslint/complexity, react-doctor/no-many-boolean-props
export function Toolbar({
  isSaved,
  activeMode,
  extractedAvailable,
  contentWidth,
  fontSizePx,
  canDecreaseFont,
  canIncreaseFont,
  readerFocusMode = false,
  onToggleSaved,
  onToggleMode,
  onCycleContentWidth,
  onDecreaseFontSize,
  onIncreaseFontSize,
  onTranslateArticle,
  onOpenOriginal,
  onShareArticle,
  variant = "inline",
  controlSize = "default",
  hideFontControls = false,
  readerFocusVariant = "full",
  tooltipSide = "top",
  tooltipCollisionAvoidance,
}: ToolbarProps) {
  const isMobile = useMediaQuery({ max: "md" });
  const prefersReducedMotion = useReducedMotion();
  const tooltipSideOffset = variant === "floating" ? 10 : 8;
  const useLargeControls = controlSize === "large";
  const compactReaderFocusMode = readerFocusMode && readerFocusVariant === "compact";
  const actionTransition = springTransition("emphasized", prefersReducedMotion);
  const actionMotionProps = {
    ...controlSwapMotion(prefersReducedMotion),
    transition: actionTransition,
  };

  return (
    <LazyMotion features={domAnimation}>
      <ToolbarRoot
        aria-label="Reader tools"
        className={cn(
          "min-w-0",
          variant !== "inline" && "reader-floating-toolbar rounded-xl px-1.5 py-1",
        )}
        variant="ghost"
      >
        <ToolbarGroup className="min-w-0 gap-1">
          <ReaderToolbarButton
            label={isSaved ? "Remove from read later" : "Read later"}
            active={isSaved}
            onClick={(anchor) =>
              onToggleSaved({ anchor, side: tooltipSide, sideOffset: tooltipSideOffset })
            }
            tooltipSide={tooltipSide}
            tooltipCollisionAvoidance={tooltipCollisionAvoidance}
            tooltipSideOffset={tooltipSideOffset}
            large={useLargeControls}
            activeClassName="text-mizu"
          >
            {isSaved ? <BookmarkFill /> : <BookmarkLine />}
          </ReaderToolbarButton>
          <AnimatePresence initial={false} mode="popLayout">
            {readerFocusMode && !compactReaderFocusMode ? (
              <m.div layout className="flex" {...actionMotionProps} key="translate-article">
                <ReaderToolbarButton
                  label="Translate article"
                  onClick={onTranslateArticle}
                  tooltipSide={tooltipSide}
                  tooltipCollisionAvoidance={tooltipCollisionAvoidance}
                  tooltipSideOffset={tooltipSideOffset}
                  large={useLargeControls}
                >
                  <Translate2Line />
                </ReaderToolbarButton>
              </m.div>
            ) : null}
          </AnimatePresence>
          {readerFocusMode ? (
            <m.div layout className="flex" transition={actionTransition}>
              <ReaderToolbarButton
                label="Open source"
                onClick={onOpenOriginal}
                tooltipSide={tooltipSide}
                tooltipCollisionAvoidance={tooltipCollisionAvoidance}
                tooltipSideOffset={tooltipSideOffset}
                large={useLargeControls}
              >
                <ExternalLinkLine />
              </ReaderToolbarButton>
            </m.div>
          ) : null}
          <AnimatePresence initial={false} mode="popLayout">
            {readerFocusMode && !compactReaderFocusMode ? (
              <m.div layout className="flex" {...actionMotionProps} key="share-article">
                <ReaderToolbarButton
                  label="Share article"
                  onClick={onShareArticle}
                  tooltipSide={tooltipSide}
                  tooltipCollisionAvoidance={tooltipCollisionAvoidance}
                  tooltipSideOffset={tooltipSideOffset}
                  large={useLargeControls}
                >
                  <ShareForwardLine />
                </ReaderToolbarButton>
              </m.div>
            ) : null}
          </AnimatePresence>
          {!readerFocusMode ? (
            <ReaderToolbarButton
              label={
                activeMode === "original" ? "Showing original source" : "Showing extracted source"
              }
              active={activeMode === "extracted"}
              disabled={!extractedAvailable}
              onClick={onToggleMode}
              tooltipSide={tooltipSide}
              tooltipCollisionAvoidance={tooltipCollisionAvoidance}
              tooltipSideOffset={tooltipSideOffset}
              large={useLargeControls}
            >
              {activeMode === "extracted" ? <TextFill /> : <TextLine />}
            </ReaderToolbarButton>
          ) : null}
          {!readerFocusMode && !isMobile ? (
            <ReaderToolbarButton
              label={`Content width: ${CONTENT_WIDTH_LABELS[contentWidth]}`}
              onClick={onCycleContentWidth}
              tooltipSide={tooltipSide}
              tooltipCollisionAvoidance={tooltipCollisionAvoidance}
              tooltipSideOffset={tooltipSideOffset}
              large={useLargeControls}
            >
              {contentWidth === "narrow" ? <SquareLine /> : <RectangleLine />}
            </ReaderToolbarButton>
          ) : null}
        </ToolbarGroup>
        {hideFontControls ? null : (
          <ReaderFontSizeControlGroup
            canDecreaseFont={canDecreaseFont}
            canIncreaseFont={canIncreaseFont}
            fontSizePx={fontSizePx}
            onDecreaseFontSize={onDecreaseFontSize}
            onIncreaseFontSize={onIncreaseFontSize}
            tooltipSide={tooltipSide}
            tooltipCollisionAvoidance={tooltipCollisionAvoidance}
            tooltipSideOffset={tooltipSideOffset}
          />
        )}
        <AnimatePresence initial={false} mode="popLayout">
          {readerFocusMode ? null : (
            <m.div
              layout
              className="flex items-center"
              {...actionMotionProps}
              key="secondary-actions"
            >
              <ToolbarSeparator className="hidden h-9 sm:block" inset orientation="vertical" />
              <ToolbarGroup className="gap-1">
                <ReaderToolbarButton
                  label="Open source"
                  onClick={onOpenOriginal}
                  tooltipSide={tooltipSide}
                  tooltipCollisionAvoidance={tooltipCollisionAvoidance}
                  tooltipSideOffset={tooltipSideOffset}
                  large={useLargeControls}
                >
                  <ExternalLinkLine />
                </ReaderToolbarButton>
              </ToolbarGroup>
            </m.div>
          )}
        </AnimatePresence>
      </ToolbarRoot>
    </LazyMotion>
  );
}

export function ReaderFontSizeControls({
  canDecreaseFont,
  canIncreaseFont,
  fontSizePx,
  onDecreaseFontSize,
  onIncreaseFontSize,
  tooltipSide = "top",
  tooltipCollisionAvoidance,
  tooltipSideOffset = 8,
}: Pick<
  ToolbarProps,
  "canDecreaseFont" | "canIncreaseFont" | "fontSizePx" | "onDecreaseFontSize" | "onIncreaseFontSize"
> & {
  tooltipSide?: NonNullable<ToolbarProps["tooltipSide"]>;
  tooltipCollisionAvoidance?: ToolbarProps["tooltipCollisionAvoidance"];
  tooltipSideOffset?: number;
}) {
  return (
    <ToolbarRoot
      aria-label="Reader font size"
      className="min-w-0 overflow-hidden [&>*]:relative"
      variant="pill"
    >
      <ReaderFontSizeControlGroup
        canDecreaseFont={canDecreaseFont}
        canIncreaseFont={canIncreaseFont}
        fontSizePx={fontSizePx}
        onDecreaseFontSize={onDecreaseFontSize}
        onIncreaseFontSize={onIncreaseFontSize}
        className="h-full bg-transparent p-0"
        tooltipSide={tooltipSide}
        tooltipCollisionAvoidance={tooltipCollisionAvoidance}
        tooltipSideOffset={tooltipSideOffset}
      />
    </ToolbarRoot>
  );
}

function ReaderFontSizeControlGroup({
  canDecreaseFont,
  canIncreaseFont,
  fontSizePx,
  onDecreaseFontSize,
  onIncreaseFontSize,
  className,
  tooltipSide = "top",
  tooltipCollisionAvoidance,
  tooltipSideOffset = 8,
}: Pick<
  ToolbarProps,
  "canDecreaseFont" | "canIncreaseFont" | "fontSizePx" | "onDecreaseFontSize" | "onIncreaseFontSize"
> & {
  className?: string;
  tooltipSide?: NonNullable<ToolbarProps["tooltipSide"]>;
  tooltipCollisionAvoidance?: ToolbarProps["tooltipCollisionAvoidance"];
  tooltipSideOffset?: number;
}) {
  return (
    <ToolbarGroup className={cn("h-full gap-1 rounded-full p-0.5", className)}>
      <ReaderToolbarButton
        label="Decrease font size"
        disabled={!canDecreaseFont}
        onClick={onDecreaseFontSize}
        tooltipSide={tooltipSide}
        tooltipCollisionAvoidance={tooltipCollisionAvoidance}
        tooltipSideOffset={tooltipSideOffset}
      >
        <MinimizeFill />
      </ReaderToolbarButton>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex h-full items-center" />}>
          <FontSizeTicker value={fontSizePx} />
        </TooltipTrigger>
        <TooltipPopup
          collisionAvoidance={tooltipCollisionAvoidance}
          side={tooltipSide}
          sideOffset={tooltipSideOffset}
        >
          Font size {fontSizePx}
        </TooltipPopup>
      </Tooltip>
      <ReaderToolbarButton
        label="Increase font size"
        disabled={!canIncreaseFont}
        onClick={onIncreaseFontSize}
        tooltipSide={tooltipSide}
        tooltipCollisionAvoidance={tooltipCollisionAvoidance}
        tooltipSideOffset={tooltipSideOffset}
      >
        <AddFill />
      </ReaderToolbarButton>
    </ToolbarGroup>
  );
}

function ReaderToolbarButton({
  label,
  children,
  onClick,
  active = false,
  disabled = false,
  className,
  activeClassName,
  tooltipSide = "top",
  tooltipCollisionAvoidance,
  tooltipSideOffset = 8,
  large = false,
}: {
  label: string;
  children?: React.ReactNode;
  onClick: (anchor: HTMLButtonElement) => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  activeClassName?: string;
  tooltipSide?: NonNullable<ToolbarProps["tooltipSide"]>;
  tooltipCollisionAvoidance?: ToolbarProps["tooltipCollisionAvoidance"];
  tooltipSideOffset?: number;
  large?: boolean;
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
                  large && "size-9 [&_svg]:size-5!",
                  active && "bg-accent/50 text-foreground",
                  active && activeClassName,
                  className,
                )}
                disabled={disabled}
                shape="pill"
                size={large ? "icon-lg" : "icon-sm"}
                variant="ghost-muted"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onClick(event.currentTarget);
                }}
              />
            }
          >
            {children}
          </ToolbarButton>
        }
      />
      <TooltipPopup
        collisionAvoidance={tooltipCollisionAvoidance}
        side={tooltipSide}
        sideOffset={tooltipSideOffset}
      >
        {label}
      </TooltipPopup>
    </Tooltip>
  );
}
