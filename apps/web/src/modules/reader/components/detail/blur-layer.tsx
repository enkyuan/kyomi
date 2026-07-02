"use client";

import type { CSSProperties } from "react";

const DETAIL_BLUR_HEIGHT_PX = 64;
const DETAIL_BLUR_FEATHER_PX = 8;
const DETAIL_BLUR_OPACITY_STYLE = {
  opacity: "clamp(0, calc(var(--scroll-area-overflow-y-start) / 24px), 1)",
} as CSSProperties;
const DETAIL_BLUR_STRIPS = [
  { blur: "6px", start: 0, end: 18, opacity: 0.26 },
  { blur: "4.75px", start: 6, end: 24, opacity: 0.22 },
  { blur: "3.5px", start: 14, end: 32, opacity: 0.18 },
  { blur: "2.5px", start: 22, end: 40, opacity: 0.15 },
  { blur: "1.75px", start: 30, end: 48, opacity: 0.13 },
  { blur: "1.1px", start: 38, end: 56, opacity: 0.11 },
  { blur: "0.6px", start: 46, end: 64, opacity: 0.09 },
] as const;

function createDetailBlurMask(start: number, end: number): string {
  const clampedStart = Math.max(0, start);
  const clampedEnd = Math.min(DETAIL_BLUR_HEIGHT_PX, end);
  const featherStart = Math.max(clampedStart, clampedEnd - DETAIL_BLUR_FEATHER_PX);
  const featherEnd = Math.min(clampedEnd, clampedStart + DETAIL_BLUR_FEATHER_PX);

  return [
    "linear-gradient(to bottom,",
    `transparent 0px,`,
    `transparent ${clampedStart}px,`,
    `rgba(0, 0, 0, 0.88) ${featherEnd}px,`,
    `black ${featherStart}px,`,
    `transparent ${clampedEnd}px,`,
    `transparent ${DETAIL_BLUR_HEIGHT_PX}px)`,
  ].join(" ");
}

export function BlurLayer({ topOffset }: { topOffset: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-10 overflow-hidden"
      style={{
        ...DETAIL_BLUR_OPACITY_STYLE,
        height: `${DETAIL_BLUR_HEIGHT_PX}px`,
        top: `${topOffset}px`,
      }}
    >
      {DETAIL_BLUR_STRIPS.map((strip) => (
        <div
          key={`${strip.blur}-${strip.start}-${strip.end}`}
          className="absolute inset-x-0 top-0 h-full"
          style={
            {
              opacity: strip.opacity,
              WebkitMaskImage: createDetailBlurMask(strip.start, strip.end),
              maskImage: createDetailBlurMask(strip.start, strip.end),
              backdropFilter: `blur(${strip.blur})`,
              WebkitBackdropFilter: `blur(${strip.blur})`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
