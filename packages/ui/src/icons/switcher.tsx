import type { SVGProps } from "react";

/**
 * Renderer-neutral geometry for Mingcute's SelectorVerticalLine glyph.
 * No active/inactive distinction — Mingcute's "Fill" sibling is a
 * collapse-direction variant, not a focus state, so it isn't used here.
 *
 * Mingcute's source path only fills ~23%x39% of its nominal 24x24 box (vs
 * 70%+ for the sibling tab icons' glyphs), reading visibly smaller and
 * thinner at a shared render `size`. Scaled 1.7x from its own center (12,12)
 * — chosen to land at ~70% box-height fill to match siblings, verified to
 * stay within the 0-24 viewBox — rather than cropping the viewBox (which
 * would only shrink the visible window, not fix the fill-ratio mismatch)
 * or adding a stroke outline (which rounds off the chevrons' points).
 *
 * Source: @mingcute/react@1.4.1 (Apache-2.0). See ./README.md.
 */
export const SwitcherIconGeometry = {
  viewBox: "0 0 24 24",
  d: "M9.802 14.198L12 16.396l2.198-2.198a1.7 1.7 0 0 1 2.404 2.404l-3.4 3.4a1.7 1.7 0 0 1-2.404 0l-3.4-3.4a1.7 1.7 0 1 1 2.404-2.404m0-4.396L12 7.604l2.198 2.198a1.7 1.7 0 0 0 2.404-2.404l-3.4-3.4a1.7 1.7 0 0 0-2.404 0l-3.4 3.4a1.7 1.7 0 0 0 2.404 2.404",
} as const;

export type SwitcherIconProps = Omit<SVGProps<SVGSVGElement>, "height" | "width"> & {
  size?: number;
};

export function SwitcherIcon({ size = 20, fill = "currentColor", ...props }: SwitcherIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      focusable="false"
      height={size}
      viewBox={SwitcherIconGeometry.viewBox}
      width={size}
    >
      <path d={SwitcherIconGeometry.d} fill={fill} />
    </svg>
  );
}
