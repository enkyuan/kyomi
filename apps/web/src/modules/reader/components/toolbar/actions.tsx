"use client";

import type React from "react";
import { FormRectangleIcon, SquareIcon, TextFilledIcon, TextIcon } from "@kyomi/ui/icons/blode";
import { AnimatePresence, m, type controlSwapMotion } from "@kyomi/ui/lib/motion";
import { Button } from "@kyomi/ui/components/button";
import { ToolbarButton } from "@kyomi/ui/components/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@kyomi/ui/components/tooltip";
import { useMediaQuery } from "@kyomi/ui/hooks/use-media-query";
import type { ToolbarProps } from "@modules/reader/lib/toolbar";
import type { ReaderContentWidth } from "@modules/reader/lib/preferences";
import { cn } from "@kyomi/ui/lib/utils";

const CONTENT_WIDTH_LABELS: Record<ReaderContentWidth, string> = {
  narrow: "Narrow",
  wide: "Wide",
};

export type ToolbarTipProps = {
  tooltipSide: NonNullable<ToolbarProps["tooltipSide"]>;
  tooltipCollisionAvoidance: ToolbarProps["tooltipCollisionAvoidance"];
  tooltipSideOffset: number;
  large: boolean;
};

export function FocusAnimatedAction({
  visible,
  actionKey,
  label,
  onClick,
  motionProps,
  tip,
  children,
}: {
  visible: boolean;
  actionKey: string;
  label: string;
  onClick: (anchor: HTMLButtonElement) => void;
  motionProps: ReturnType<typeof controlSwapMotion> & { transition: unknown };
  tip: ToolbarTipProps;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      {visible ? (
        <m.div layout className="flex" {...(motionProps as object)} key={actionKey}>
          <ReaderToolbarButton label={label} onClick={onClick} {...tip}>
            {children}
          </ReaderToolbarButton>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

export function SourceModeButton({
  activeMode,
  extractedAvailable,
  onToggleMode,
  tip,
}: Pick<ToolbarProps, "activeMode" | "extractedAvailable" | "onToggleMode"> & {
  tip: ToolbarTipProps;
}) {
  return (
    <ReaderToolbarButton
      label={activeMode === "original" ? "Showing original source" : "Showing extracted source"}
      active={activeMode === "extracted"}
      disabled={!extractedAvailable}
      onClick={onToggleMode}
      {...tip}
    >
      {activeMode === "extracted" ? <TextFilledIcon /> : <TextIcon />}
    </ReaderToolbarButton>
  );
}

export function ContentWidthButton({
  contentWidth,
  onCycleContentWidth,
  tip,
}: Pick<ToolbarProps, "contentWidth" | "onCycleContentWidth"> & { tip: ToolbarTipProps }) {
  const isMobile = useMediaQuery({ max: "md" });
  if (isMobile) {
    return null;
  }
  return (
    <ReaderToolbarButton
      label={`Content width: ${CONTENT_WIDTH_LABELS[contentWidth]}`}
      onClick={onCycleContentWidth}
      {...tip}
    >
      {contentWidth === "narrow" ? <SquareIcon /> : <FormRectangleIcon />}
    </ReaderToolbarButton>
  );
}

export function ReaderToolbarButton({
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
