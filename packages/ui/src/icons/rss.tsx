import type { SVGProps } from "react";

/**
 * Renderer-neutral geometry for Mingcute's Rss2Fill glyph.
 *
 * Source: @mingcute/react@1.4.1 (Apache-2.0). See ./README.md.
 */
export const RssIconGeometry = {
  viewBox: "0 0 24 24",
  fill: {
    d: "M5 17a2 2 0 1 1 0 4 2 2 0 0 1 0-4M5 3c8.837 0 16 7.163 16 16q0 .277-.01.55a1.5 1.5 0 1 1-2.997-.1A13 13 0 0 0 18 19c0-7.18-5.82-13-13-13q-.225 0-.45.008a1.5 1.5 0 0 1-.1-2.999Q4.722 3 5 3m0 7a9 9 0 0 1 8.98 9.599 1.5 1.5 0 1 1-2.993-.198 6 6 0 0 0-6.388-6.388 1.5 1.5 0 0 1-.197-2.993Q4.699 10 5 10",
  },
} as const;

export type RssIconProps = Omit<SVGProps<SVGSVGElement>, "height" | "width"> & {
  size?: number;
};

export function RssIcon({ size = 20, fill = "currentColor", ...props }: RssIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      focusable="false"
      height={size}
      viewBox={RssIconGeometry.viewBox}
      width={size}
    >
      <path d={RssIconGeometry.fill.d} fill={fill} />
    </svg>
  );
}
