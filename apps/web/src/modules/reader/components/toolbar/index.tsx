"use client";

import type React from "react";
import { useEffect, useRef } from "react";
import {
  AddFill,
  BookmarkFill,
  BookmarkLine,
  Copy2Line,
  RectangleLine,
  ExternalLinkLine,
  HeadAiLine,
  ShareForwardLine,
  SquareLine,
  MinimizeFill,
  TextFill,
  TextLine,
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
  onCopyLink,
  onOpenOriginal,
  onOpenAi,
  onShareArticle,
  variant = "inline",
  controlSize = "default",
  hideFontControls = false,
  readerFocusVariant = "full",
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
            tooltipSideOffset={tooltipSideOffset}
            large={useLargeControls}
            activeClassName={SAVED_ACTION_ACTIVE_CLASS}
          >
            {isSaved ? <BookmarkFill /> : <BookmarkLine />}
          </ReaderToolbarButton>
          <AnimatePresence initial={false} mode="popLayout">
            {readerFocusMode && !compactReaderFocusMode ? (
              <m.div key="copy-link" layout className="flex" {...actionMotionProps}>
                <ReaderToolbarButton
                  label="Copy link"
                  onClick={onCopyLink}
                  tooltipSideOffset={tooltipSideOffset}
                  large={useLargeControls}
                >
                  <Copy2Line />
                </ReaderToolbarButton>
              </m.div>
            ) : null}
          </AnimatePresence>
          {readerFocusMode ? (
            <m.div layout className="flex" transition={actionTransition}>
              <ReaderToolbarButton
                label="Open source"
                onClick={onOpenOriginal}
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
                    tooltipSideOffset={tooltipSideOffset}
                    large={useLargeControls}
                  >
                    <ExternalLinkLine />
                  </ReaderToolbarButton>
                ) : null}
                <ReaderToolbarButton
                  label="Distill this article"
                  onClick={onOpenAi}
                  tooltipSideOffset={tooltipSideOffset}
                  large={useLargeControls}
                >
                  <HeadAiLine />
                </ReaderToolbarButton>
                {readerFocusMode ? (
                  <ReaderToolbarButton
                    label="Share article"
                    onClick={onShareArticle}
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
  tooltipSideOffset = 8,
}: Pick<
  ToolbarProps,
  "canDecreaseFont" | "canIncreaseFont" | "fontSizePx" | "onDecreaseFontSize" | "onIncreaseFontSize"
> & {
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
  tooltipSideOffset = 8,
}: Pick<
  ToolbarProps,
  "canDecreaseFont" | "canIncreaseFont" | "fontSizePx" | "onDecreaseFontSize" | "onIncreaseFontSize"
> & {
  className?: string;
  tooltipSideOffset?: number;
}) {
  return (
    <ToolbarGroup className={cn("h-full gap-1 rounded-full p-0.5", className)}>
      <ReaderToolbarButton
        label="Decrease font size"
        disabled={!canDecreaseFont}
        onClick={onDecreaseFontSize}
        tooltipSideOffset={tooltipSideOffset}
      >
        <MinimizeFill />
      </ReaderToolbarButton>
      <FontSizeTicker value={fontSizePx} />
      <ReaderToolbarButton
        label="Increase font size"
        disabled={!canIncreaseFont}
        onClick={onIncreaseFontSize}
        tooltipSideOffset={tooltipSideOffset}
      >
        <AddFill />
      </ReaderToolbarButton>
    </ToolbarGroup>
  );
}

function useTickerDirection(value: number) {
  const previousValueRef = useRef(value);
  const direction =
    value > previousValueRef.current ? 1 : value < previousValueRef.current ? -1 : 0;

  useEffect(() => {
    previousValueRef.current = value;
  }, [value]);

  return direction;
}

function FontSizeTicker({ value }: { value: number }) {
  const prefersReducedMotion = useReducedMotion();
  const direction = useTickerDirection(value);
  const valueText = String(value);
  const digits = valueText.split("").map((digit, offset) => ({
    digit,
    place: valueText.length - offset,
  }));

  return (
    <LazyMotion features={domAnimation}>
      <span
        aria-label={`Font size ${value}`}
        className="flex min-w-7 items-center justify-center px-0.5 text-xs font-medium leading-none text-muted-foreground tabular-nums"
      >
        {digits.map(({ digit, place }) => (
          <span
            key={`font-size-place-${place}`}
            aria-hidden
            className="relative inline-block h-4 w-[0.62em] overflow-hidden"
          >
            <AnimatePresence initial={false} mode="popLayout">
              <m.span
                key={`${digit}-${place}`}
                className="absolute inset-0 flex items-center justify-center"
                initial={
                  prefersReducedMotion || direction === 0
                    ? false
                    : { opacity: 0, y: direction > 0 ? 8 : -8 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={
                  prefersReducedMotion || direction === 0
                    ? undefined
                    : { opacity: 0, y: direction > 0 ? -8 : 8 }
                }
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: "spring", duration: 0.24, bounce: 0 }
                }
              >
                {digit}
              </m.span>
            </AnimatePresence>
          </span>
        ))}
      </span>
    </LazyMotion>
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
  tooltipSideOffset = 8,
  large = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  activeClassName?: string;
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
      <TooltipPopup sideOffset={tooltipSideOffset}>{label}</TooltipPopup>
    </Tooltip>
  );
}
