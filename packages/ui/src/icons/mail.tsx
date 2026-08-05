import type { SVGProps } from "react";

/**
 * Renderer-neutral geometry for Mingcute's MailLine glyph.
 *
 * Source: @mingcute/react@1.4.1 (Apache-2.0). See ./README.md.
 */
export const MailIconGeometry = {
  viewBox: "0 0 24 24",
  paths: [
    {
      d: "M20 4a2 2 0 0 1 1.995 1.85L22 6v12a2 2 0 0 1-1.85 1.995L20 20H4a2 2 0 0 1-1.995-1.85L2 18V6a2 2 0 0 1 1.85-1.995L4 4zm0 3.414-6.94 6.94a1.5 1.5 0 0 1-2.12 0L4 7.414V18h16zM18.586 6H5.414L12 12.586z",
    },
  ],
} as const;

export type MailIconProps = Omit<SVGProps<SVGSVGElement>, "height" | "width"> & {
  size?: number;
};

export function MailIcon({ size = 20, fill = "currentColor", ...props }: MailIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      focusable="false"
      height={size}
      viewBox={MailIconGeometry.viewBox}
      width={size}
    >
      {MailIconGeometry.paths.map((path) => (
        <path d={path.d} fill={fill} key={path.d} />
      ))}
    </svg>
  );
}
