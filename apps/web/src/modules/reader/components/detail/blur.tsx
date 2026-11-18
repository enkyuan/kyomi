"use client";

import type { CSSProperties } from "react";

// Base UI registers the scroll variables as non-inherited, so each level opts in to the parent's value.
// Put `SCROLL_OFFSET_INHERIT` on every element between the scroll viewport and a `BarBlur`.
export const SCROLL_OFFSET_INHERIT =
  "[--scroll-area-overflow-y-start:inherit] [--scroll-area-overflow-y-end:inherit]";

const SCROLL_STYLE = {
  "--scroll-area-overflow-y-start": "inherit",
  "--scroll-area-overflow-y-end": "inherit",
} as CSSProperties;

// Values from `@kyomi/ui/styles/scroll-mask.css`, so a bar fades like a `scroll-mask-*` scroller:
// the mask is `black, black <FADE_FROM>, transparent`, and it animates over the first
// `SCROLL_RANGE` of the scroll timeline (scroll-mask's `0%` to `10%` keyframes).
const FADE_FROM = 0.8; // `--scroll-mask-fade-from-*` default (80%)
const SCROLL_RANGE = 0.1; // scroll-mask's keyframe range (10%)

// Scroll progress is start / (start + end). `tan(atan2(length, length))` turns the length ratio
// into a number without typed-unit division; with nothing to scroll it is 0, so nothing is veiled.
const FADE = `clamp(0, calc(tan(atan2(var(--scroll-area-overflow-y-start), calc(var(--scroll-area-overflow-y-start) + var(--scroll-area-overflow-y-end)))) / ${SCROLL_RANGE}), 1)`;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// scroll-mask's gradient over `extent` percent of the layer: opaque until `FADE_FROM` of the extent,
// then transparent.
function scrollMask(extent: number): string {
  return `linear-gradient(to bottom, black, black ${round(extent * FADE_FROM)}%, transparent ${extent}%)`;
}

type BlurStrip = { blur: number; extent: number };

// Fade each strip rather than the layer: an ancestor with opacity below 1 is a backdrop root, which
// leaves the strips' backdrop-filter nothing to sample. The strips overlap, so the filters compound
// toward the top edge: `--bar-blur-dim` (below 1 only in dark mode) keeps bright type from glowing
// through, and `--bar-blur-saturate` drains colour from large flat shapes such as logos and
// screenshots, which blur alone cannot hide because a blur leaves the inside of a shape untouched.
function stripStyle({ blur, extent }: BlurStrip): CSSProperties {
  const filter = `blur(${blur}px) brightness(var(--bar-blur-dim, 1)) saturate(var(--bar-blur-saturate, 1))`;
  const mask = scrollMask(extent);

  return {
    ...SCROLL_STYLE,
    opacity: FADE,
    WebkitMaskImage: mask,
    maskImage: mask,
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
  } as CSSProperties;
}

// The layer is the bar plus the tail of the mask: sized so the bar fills the opaque `FADE_FROM` of
// it and the fade runs below. Bar: blur that doubles per level toward the top edge, up to 16px. The
// lightest strip runs to the layer's bottom edge and the heaviest to the bar's bottom edge, with the
// extents spaced evenly between, so the strong blur holds through the bar and tapers below it.
const BAR_LEVELS = 5;
const BAR_MIN_BLUR = 1;
const LAYER_HEIGHT = `${round(100 / FADE_FROM)}%`;

const BAR_STRIPS: readonly BlurStrip[] = Array.from({ length: BAR_LEVELS }, (_, level) => ({
  blur: BAR_MIN_BLUR * 2 ** level,
  extent: round(100 - (100 * (1 - FADE_FROM) * level) / (BAR_LEVELS - 1)),
}));

// Tint toward the surface colour (`--bar-blur-surface`, the page by default) so text under the
// controls stays quiet where blur alone is gentle. Same mask shape as the strips, over the whole layer.
const SURFACE = "var(--bar-blur-surface, var(--background))";
const WASH_STRENGTH = 96;
const BAR_WASH = `linear-gradient(to bottom, color-mix(in oklab, ${SURFACE} ${WASH_STRENGTH}%, transparent), color-mix(in oklab, ${SURFACE} ${WASH_STRENGTH}%, transparent) ${FADE_FROM * 100}%, transparent)`;

/** Progressive blur behind a sticky bar. Render it as the first child of the bar. */
export function BarBlur() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10"
      style={{ ...SCROLL_STYLE, height: LAYER_HEIGHT }}
    >
      {BAR_STRIPS.map((strip) => (
        <div key={strip.blur} className="absolute inset-0" style={stripStyle(strip)} />
      ))}
      <div
        className="absolute inset-0"
        style={{ ...SCROLL_STYLE, background: BAR_WASH, opacity: FADE } as CSSProperties}
      />
    </div>
  );
}

// Card surface: no sticky bar, so a fixed-height layer under the back button and toolbar carries the
// same `BarBlur` the inbox list and the browser-surface reader use, tinted toward the card.
const CARD_BAR_HEIGHT = 64;
const CARD_STYLE = { ...SCROLL_STYLE, "--bar-blur-surface": "var(--card)" } as CSSProperties;

export function BlurLayer({ topOffset }: { topOffset: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-10"
      style={{ ...CARD_STYLE, height: `${CARD_BAR_HEIGHT}px`, top: `${topOffset}px` }}
    >
      <BarBlur />
    </div>
  );
}
