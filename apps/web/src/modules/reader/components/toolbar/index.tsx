"use client";

import {
  ArrowShareRightIcon,
  BookmarkFilledIcon,
  BookmarkIcon,
  ExternalLinkIcon,
  LanguagesIcon,
  MinusIcon,
  PlusIcon,
} from "@kyomi/ui/icons/blode";
import {
  AnimatePresence,
  LazyMotion,
  controlSwapMotion,
  domAnimation,
  m,
  useReducedMotion,
  springTransition,
} from "@kyomi/ui/lib/motion";
import {
  Toolbar as ToolbarRoot,
  ToolbarGroup,
  ToolbarSeparator,
} from "@kyomi/ui/components/toolbar";
import { TextMorph } from "@kyomi/ui/components/text-morph";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/components/tooltip";
import type { ToolbarProps } from "@modules/reader/lib/toolbar";
import { cn } from "@kyomi/ui/lib/utils";
import {
  ContentWidthButton,
  FocusAnimatedAction,
  ReaderToolbarButton,
  SourceModeButton,
  type ToolbarTipProps,
} from "./actions";

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
  const prefersReducedMotion = useReducedMotion();
  const tooltipSideOffset = variant === "floating" ? 10 : 8;
  const useLargeControls = controlSize === "large";
  const showFocusExtras = readerFocusMode && readerFocusVariant !== "compact";
  const tip: ToolbarTipProps = {
    tooltipSide,
    tooltipCollisionAvoidance,
    tooltipSideOffset,
    large: useLargeControls,
  };
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
            {...tip}
            activeClassName="text-mizu"
          >
            {isSaved ? <BookmarkFilledIcon /> : <BookmarkIcon />}
          </ReaderToolbarButton>
          <FocusAnimatedAction
            visible={showFocusExtras}
            actionKey="translate-article"
            label="Translate article"
            onClick={onTranslateArticle}
            motionProps={actionMotionProps}
            tip={tip}
          >
            <LanguagesIcon />
          </FocusAnimatedAction>
          {readerFocusMode ? (
            <m.div layout className="flex" transition={actionTransition}>
              <ReaderToolbarButton label="Open source" onClick={onOpenOriginal} {...tip}>
                <ExternalLinkIcon />
              </ReaderToolbarButton>
            </m.div>
          ) : null}
          <FocusAnimatedAction
            visible={showFocusExtras}
            actionKey="share-article"
            label="Share article"
            onClick={onShareArticle}
            motionProps={actionMotionProps}
            tip={tip}
          >
            <ArrowShareRightIcon />
          </FocusAnimatedAction>
          {readerFocusMode ? null : (
            <>
              <SourceModeButton
                activeMode={activeMode}
                extractedAvailable={extractedAvailable}
                onToggleMode={onToggleMode}
                tip={tip}
              />
              <ContentWidthButton
                contentWidth={contentWidth}
                onCycleContentWidth={onCycleContentWidth}
                tip={tip}
              />
            </>
          )}
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
                <ReaderToolbarButton label="Open source" onClick={onOpenOriginal} {...tip}>
                  <ExternalLinkIcon />
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
        <MinusIcon />
      </ReaderToolbarButton>
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex h-full items-center" />}>
          <span
            aria-label={`Font size ${fontSizePx}`}
            className="flex min-w-7 items-center justify-center px-0.5 text-xs font-medium leading-none text-muted-foreground tabular-nums"
          >
            <TextMorph>{String(fontSizePx)}</TextMorph>
          </span>
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
        <PlusIcon />
      </ReaderToolbarButton>
    </ToolbarGroup>
  );
}
