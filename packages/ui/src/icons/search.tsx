import type { SVGProps } from "react";

/**
 * Renderer-neutral geometry for Mingcute's SearchLine/SearchFill glyphs.
 *
 * Source: @mingcute/react@1.4.1 (Apache-2.0). See ./README.md.
 */
export const SearchIconGeometry = {
  viewBox: "0 0 24 24",
  line: {
    d: "M10.5 2a8.5 8.5 0 1 0 5.262 15.176l3.652 3.652a1 1 0 0 0 1.414-1.414l-3.652-3.652A8.5 8.5 0 0 0 10.5 2M4 10.5a6.5 6.5 0 1 1 13 0a6.5 6.5 0 0 1-13 0",
  },
  fill: {
    d: "M10.5 2a8.5 8.5 0 0 1 6.676 13.762l3.652 3.652a1 1 0 0 1-1.414 1.414l-3.652-3.652A8.5 8.5 0 1 1 10.5 2m0 2a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13m0 1a5.5 5.5 0 1 1 0 11a5.5 5.5 0 0 1 0-11",
  },
} as const;

export type SearchIconProps = Omit<SVGProps<SVGSVGElement>, "height" | "width"> & {
  size?: number;
  focused?: boolean;
};

export function SearchIcon({
  size = 20,
  fill = "currentColor",
  focused = false,
  ...props
}: SearchIconProps) {
  const path = focused ? SearchIconGeometry.fill : SearchIconGeometry.line;
  return (
    <svg
      {...props}
      aria-hidden="true"
      focusable="false"
      height={size}
      viewBox={SearchIconGeometry.viewBox}
      width={size}
    >
      <path d={path.d} fill={fill} />
    </svg>
  );
}
