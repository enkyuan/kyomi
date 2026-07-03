"use client";

import { memo } from "react";
import type { CSSProperties } from "react";
import { cn } from "@kyomi/ui/lib/utils";
import { usePretextLayout } from "@hooks/use-pretext";

type PretextProps = {
  text: string;
  font: string;
  lineHeight: number;
  maxLines: number;
  className?: string;
  containerWidth?: number;
  style?: CSSProperties;
};

function arePretextPropsEqual(prev: PretextProps, next: PretextProps) {
  return (
    prev.text === next.text &&
    prev.font === next.font &&
    prev.lineHeight === next.lineHeight &&
    prev.maxLines === next.maxLines &&
    prev.className === next.className &&
    prev.containerWidth === next.containerWidth &&
    prev.style?.fontSize === next.style?.fontSize &&
    prev.style?.lineHeight === next.style?.lineHeight
  );
}

export const Pretext = memo(function Pretext({
  text,
  font,
  lineHeight,
  maxLines,
  className,
  containerWidth,
  style,
}: PretextProps) {
  const { ref, fittedWidth } = usePretextLayout({
    text,
    font,
    lineHeight,
    maxLines,
    containerWidth,
  });

  return (
    <p
      ref={ref}
      className={cn("w-full", className)}
      style={{
        maxWidth: fittedWidth ? `${fittedWidth}px` : undefined,
        ...style,
      }}
    >
      {text}
    </p>
  );
}, arePretextPropsEqual);
