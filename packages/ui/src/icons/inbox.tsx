import type { SVGProps } from "react";

/**
 * Renderer-neutral geometry for Mingcute's InboxLine/InboxFill glyphs.
 *
 * Source: @mingcute/react@1.4.1 (Apache-2.0). See ./README.md.
 */
export const InboxIconGeometry = {
  viewBox: "0 0 24 24",
  line: {
    d: "M14 3a2 2 0 0 1 2 2v1.055l3.642.976a2 2 0 0 1 1.414 2.45l-2.588 9.659a2 2 0 0 1-2.45 1.414l-.588-.159A2 2 0 0 1 14 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 15.479l.535.143l2.589-9.66L16 8.126zM5 5v14h9V5z",
  },
  fill: {
    d: "M14 3a2 2 0 0 1 2 2v1.055l3.642.976a2 2 0 0 1 1.414 2.45l-2.588 9.659a2 2 0 0 1-2.45 1.414l-.588-.159A2 2 0 0 1 14 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 15.479l.535.143l2.589-9.66L16 8.126z",
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
