import type { SVGProps } from "react";

/**
 * Renderer-neutral geometry for Mingcute's TimeDurationLine/TimeDurationFill glyphs.
 *
 * Source: @mingcute/react@1.4.1 (Apache-2.0). See ./README.md.
 */
export const RecentsIconGeometry = {
  viewBox: "0 0 24 24",
  line: {
    d: "M6 3a1 1 0 0 0 0 2h12a1 1 0 1 0 0-2zm-2.41 4a.5.5 0 0 0-.493.582l1.764 10.582a1 1 0 0 0 .986.836h12.306a1 1 0 0 0 .986-.836l1.764-10.582A.5.5 0 0 0 20.41 7zM6.613 17l-1.333-8h13.44l-1.334 8z",
  },
  fill: {
    d: "M5 4a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1M2.11 7.747A1.5 1.5 0 0 1 3.59 6h16.82a1.5 1.5 0 0 1 1.48 1.747l-1.764 10.582A2 2 0 0 1 18.153 20H5.847a2 2 0 0 1-1.973-1.671z",
  },
} as const;

export type RecentsIconProps = Omit<SVGProps<SVGSVGElement>, "height" | "width"> & {
  size?: number;
  focused?: boolean;
};

export function RecentsIcon({
  size = 20,
  fill = "currentColor",
  focused = false,
  ...props
}: RecentsIconProps) {
  const path = focused ? RecentsIconGeometry.fill : RecentsIconGeometry.line;
  return (
    <svg
      {...props}
      aria-hidden="true"
      focusable="false"
      height={size}
      viewBox={RecentsIconGeometry.viewBox}
      width={size}
    >
      <path d={path.d} fill={fill} />
    </svg>
  );
}
