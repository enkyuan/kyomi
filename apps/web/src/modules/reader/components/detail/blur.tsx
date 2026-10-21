"use client";

import type { CSSProperties } from "react";

type BlurStrip = { blur: number; mask: string };

// Base UI registers the scroll variable as non-inherited, so each level opts in to the parent's value.
// Put `SCROLL_OFFSET_INHERIT` on every element between the scroll viewport and a `BarBlur`.
export const SCROLL_OFFSET_INHERIT = "[--scroll-area-overflow-y-start:inherit]";

const SCROLL_STYLE = {
  "--scroll-area-overflow-y-start": "inherit",
} as CSSProperties;

// Scroll-linked fade over the first 24px of scroll, so nothing is veiled until content moves under
// the bar. `tan(atan2(length, 1px))` turns the length into a number without typed-unit division.
const FADE = "clamp(0, calc(tan(atan2(var(--scroll-area-overflow-y-start), 1px)) / 24), 1)";

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// Fade each strip rather than the layer: an ancestor with opacity below 1 is a backdrop root, which
// leaves the strips' backdrop-filter nothing to sample. The strips overlap, so the filters compound
// toward the top edge: `--bar-blur-dim` (below 1 only in dark mode) keeps bright type from glowing
// through, and `--bar-blur-saturate` drains colour from large flat shapes such as logos and
// screenshots, which blur alone cannot hide because a blur leaves the inside of a shape untouched.
function stripStyle({ blur, mask }: BlurStrip): CSSProperties {
  const filter = `blur(${blur}px) brightness(var(--bar-blur-dim, 1)) saturate(var(--bar-blur-saturate, 1))`;

  return {
    ...SCROLL_STYLE,
    opacity: FADE,
    WebkitMaskImage: mask,
    maskImage: mask,
    backdropFilter: filter,
    WebkitBackdropFilter: filter,
  } as CSSProperties;
}

// Bar: blur that doubles per level toward the top edge, up to 16px. Every offset is measured up from
// the layer's bottom edge, so the same profile fits a bar of any height and only `BAR_FEATHER`
// spills below it. Level n stays fully on until `BAR_FADE` above the point where it ends, and the
// ends are spaced evenly from the bar's bottom edge (heaviest blur) to the layer's bottom (lightest),
// so the strong blur holds through the whole bar and then tapers over the feather.
const BAR_FEATHER = 64;
const BAR_LEVELS = 5;
const BAR_MIN_BLUR = 1;
const BAR_FADE = 44;

const BAR_STRIPS: readonly BlurStrip[] = Array.from({ length: BAR_LEVELS }, (_, level) => {
  const end = round((BAR_FEATHER * level) / (BAR_LEVELS - 1));

  return {
    blur: BAR_MIN_BLUR * 2 ** level,
    mask: `linear-gradient(to bottom, black calc(100% - ${round(end + BAR_FADE)}px), transparent calc(100% - ${end}px))`,
  };
});

// Tint toward the surface colour (`--bar-blur-surface`, the page by default) so text under the
// controls stays quiet where blur alone is gentle.
const SURFACE = "var(--bar-blur-surface, var(--background))";

// The stops are measured up from the layer's bottom edge: the veil is nearly opaque inside the bar
// and thins over the feather in even steps, so a large bright shape fades in rather than appearing
// whole just below the bar.
const WASH_STOPS = [
  [98, "0"],
  [96, "40%"],
  [94, `calc(100% - ${BAR_FEATHER}px)`],
  [78, `calc(100% - ${BAR_FEATHER * 0.75}px)`],
  [52, `calc(100% - ${BAR_FEATHER * 0.5}px)`],
  [22, `calc(100% - ${BAR_FEATHER * 0.25}px)`],
] as const;

const BAR_WASH = `linear-gradient(to bottom, ${WASH_STOPS.map(
  ([percent, at]) => `color-mix(in oklab, ${SURFACE} ${percent}%, transparent) ${at}`,
).join(", ")}, transparent 100%)`;

/** Progressive blur behind a sticky bar. Render it as the first child of the bar. */
export function BarBlur() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10"
      style={{ ...SCROLL_STYLE, height: `calc(100% + ${BAR_FEATHER}px)` }}
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
