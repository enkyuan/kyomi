import type { SVGProps } from "react";

/**
 * Renderer-neutral geometry for Mingcute's InboxLine/InboxFill glyphs.
 *
 * Source: @mingcute/react@1.4.1 (Apache-2.0). See ./README.md.
 */
export const InboxIconGeometry = {
  viewBox: "0 0 24 24",
  line: {
    d: "M16.382 4a2 2 0 0 1 1.71.964l.079.142l3.512 7.025a3 3 0 0 1 .308 1.109l.009.232V19a2 2 0 0 1-1.85 1.995L20 21H4a2 2 0 0 1-1.995-1.85L2 19v-5.528a3 3 0 0 1 .22-1.13l.097-.212l3.512-7.024a2 2 0 0 1 1.628-1.1L7.618 4zM8 14H4v5h16v-5h-4v.5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 14.5zm8.382-8H7.618l-3 6H8.5a1.5 1.5 0 0 1 1.493 1.356L10 13.5v.5h4v-.5a1.5 1.5 0 0 1 1.356-1.493L15.5 12h3.882z",
  },
  fill: {
    d: "M5.83 5.106A2 2 0 0 1 7.617 4h8.764a2 2 0 0 1 1.789 1.106l3.512 7.025a3 3 0 0 1 .318 1.34V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5.528a3 3 0 0 1 .317-1.341zM16.381 6H7.618L4.12 13H7.5A1.5 1.5 0 0 1 9 14.5v1a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5v-1a1.5 1.5 0 0 1 1.5-1.5h3.38z",
  },
} as const;

export type InboxIconProps = Omit<SVGProps<SVGSVGElement>, "height" | "width"> & {
  size?: number;
  focused?: boolean;
};

export function InboxIcon({
  size = 20,
  fill = "currentColor",
  focused = false,
  ...props
}: InboxIconProps) {
  const path = focused ? InboxIconGeometry.fill : InboxIconGeometry.line;
  return (
    <svg
      {...props}
      aria-hidden="true"
      focusable="false"
      height={size}
      viewBox={InboxIconGeometry.viewBox}
      width={size}
    >
      <path d={path.d} fill={fill} />
    </svg>
  );
}
