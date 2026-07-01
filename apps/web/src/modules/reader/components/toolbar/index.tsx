"use client";

import type React from "react";
import {
  AddFill,
  BookmarkFill,
  BookmarkLine,
  RectangleLine,
  ExternalLinkLine,
  HeadAiLine,
  ShareForwardLine,
  SquareLine,
  MinimizeFill,
  TextFill,
  TextLine,
  Translate2Line,
} from "@mingcute/react";
import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react";
import { Button } from "@kyomi/ui/button";
import {
  Toolbar as ToolbarRoot,
  ToolbarButton,
  ToolbarGroup,
  ToolbarSeparator,
} from "@kyomi/ui/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/tooltip";
import { useMediaQuery } from "@hooks/use-media-query";
import type { ToolbarProps } from "@modules/reader/hooks/use-toolbar";
import type { ReaderContentWidth } from "@modules/reader/hooks/use-reader-preferences";
import { SAVED_ACTION_ACTIVE_CLASS } from "@lib/theme/action-colors";
import { cn } from "@lib/utils";
import { FontSizeTicker } from "./font-size-ticker";

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
  onOpenAi,
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
  const actionTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.3, bounce: 0 };
  const actionMotionProps = {
    initial: prefersReducedMotion ? false : { opacity: 0, scale: 0.92, filter: "blur(4px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
    exit: prefersReducedMotion ? undefined : { opacity: 0, scale: 0.92, filter: "blur(4px)" },
    transition: actionTransition,
  };

  return (
    <LazyMotion features={domAnimation}>
      <ToolbarRoot
        aria-label="Reader tools"
        className={cn(
          "min-w-0 gap-1 border-0 p-0 text-muted-foreground shadow-none",
          variant === "inline"
            ? "bg-transparent"
            : "reader-floating-toolbar rounded-xl px-1.5 py-1",
        )}
      >
        <ToolbarGroup className="min-w-0 gap-1">
          <ReaderToolbarButton
            label={isSaved ? "Remove from read later" : "Read later"}
            active={isSaved}
            onClick={onToggleSaved}
            tooltipSide={tooltipSide}
            tooltipCollisionAvoidance={tooltipCollisionAvoidance}
            tooltipSideOffset={tooltipSideOffset}
            large={useLargeControls}
            activeClassName={SAVED_ACTION_ACTIVE_CLASS}
          >
            {isSaved ? <BookmarkFill /> : <BookmarkLine />}
          </ReaderToolbarButton>
          <AnimatePresence initial={false} mode="popLayout">
            {readerFocusMode && !compactReaderFocusMode ? (
              <m.div key="translate-article" layout className="flex" {...actionMotionProps}>
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
          {compactReaderFocusMode ? null : (
            <m.div
              key="secondary-actions"
              layout
              className="flex items-center"
              {...actionMotionProps}
            >
              <ToolbarSeparator
                className="mx-1 hidden h-9 w-px self-center bg-border/70 data-[orientation=vertical]:my-0 sm:block"
                orientation="vertical"
              />
              <ToolbarGroup className="gap-1">
                {!readerFocusMode ? (
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
                ) : null}
                <ReaderToolbarButton
                  label="Distill this article"
                  onClick={onOpenAi}
                  tooltipSide={tooltipSide}
                  tooltipCollisionAvoidance={tooltipCollisionAvoidance}
                  tooltipSideOffset={tooltipSideOffset}
                  large={useLargeControls}
                >
                  <HeadAiLine />
                </ReaderToolbarButton>
                {readerFocusMode ? (
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
                ) : null}
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
      className="relative h-11 min-w-0 items-center gap-1 overflow-hidden rounded-full border-0 bg-background p-1 text-muted-foreground shadow-none before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:bg-muted [&>*]:relative"
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
  onClick: () => void;
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
                  "rounded-full text-muted-foreground transition-[color,background-color,transform] hover:text-foreground data-pressed:text-foreground",
                  large && "size-9",
                  active && "bg-accent/50 text-foreground",
                  active && activeClassName,
                  className,
                )}
                disabled={disabled}
                size={large ? "icon-lg" : "icon-sm"}
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
