import type { SVGProps } from "react";

/**
 * Renderer-neutral geometry for Mingcute's CloseLine glyph.
 *
 * Source: @mingcute/react@1.4.1 (Apache-2.0). See ./README.md.
 */
export const CloseIconGeometry = {
  viewBox: "0 0 24 24",
  paths: [
    {
      d: "m12 13.414 5.657 5.657a1 1 0 0 0 1.414-1.414L13.414 12l5.657-5.657a1 1 0 0 0-1.414-1.414L12 10.586 6.343 4.929A1 1 0 0 0 4.93 6.343L10.586 12l-5.657 5.657a1 1 0 1 0 1.414 1.414z",
    },
  ],
} as const;

export type CloseIconProps = Omit<SVGProps<SVGSVGElement>, "height" | "width"> & {
  size?: number;
};

export function CloseIcon({ size = 20, fill = "currentColor", ...props }: CloseIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      focusable="false"
      height={size}
      viewBox={CloseIconGeometry.viewBox}
      width={size}
    >
      {CloseIconGeometry.paths.map((path) => (
        <path d={path.d} fill={fill} key={path.d} />
      ))}
    </svg>
  );
}
