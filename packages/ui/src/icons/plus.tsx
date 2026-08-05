import type { SVGProps } from "react";

/**
 * Renderer-neutral geometry for Mingcute's AddLine glyph.
 *
 * Source: @mingcute/react@1.4.1 (Apache-2.0). See ./README.md.
 */
export const PlusIconGeometry = {
  viewBox: "0 0 24 24",
  paths: [
    {
      d: "M11 20a1 1 0 1 0 2 0v-7h7a1 1 0 1 0 0-2h-7V4a1 1 0 1 0-2 0v7H4a1 1 0 1 0 0 2h7z",
    },
  ],
} as const;

export type PlusIconProps = Omit<SVGProps<SVGSVGElement>, "height" | "width"> & {
  size?: number;
};

export function PlusIcon({ size = 20, fill = "currentColor", ...props }: PlusIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      focusable="false"
      height={size}
      viewBox={PlusIconGeometry.viewBox}
      width={size}
    >
      {PlusIconGeometry.paths.map((path) => (
        <path d={path.d} fill={fill} key={path.d} />
      ))}
    </svg>
  );
}
