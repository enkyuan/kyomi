import type { SVGProps } from "react";

/**
 * Renderer-neutral geometry for Mingcute's TimeDurationLine/TimeDurationFill glyphs.
 *
 * Source: @mingcute/react@1.4.1 (Apache-2.0). See ./README.md.
 */
export const RecentsIconGeometry = {
  viewBox: "0 0 24 24",
  line: {
    d: "M10.975 3.002a1 1 0 0 1-.754 1.196a8 8 0 0 0-.583.156a1 1 0 0 1-.59-1.911q.36-.112.73-.195a1 1 0 0 1 1.197.754m2.05 0a1 1 0 0 1 1.196-.754c4.454 1.01 7.78 4.992 7.78 9.752c0 5.523-4.478 10-10 10c-4.761 0-8.743-3.325-9.753-7.779a1 1 0 0 1 1.95-.442a8 8 0 1 0 9.58-9.58a1 1 0 0 1-.753-1.197M6.614 4.72a1 1 0 0 1-.053 1.414q-.222.205-.427.426A1 1 0 0 1 4.668 5.2q.255-.276.532-.533a1 1 0 0 1 1.414.053M12 6a1 1 0 0 1 1 1v4.586l2.707 2.707a1 1 0 0 1-1.414 1.414l-3-3A1 1 0 0 1 11 12V7a1 1 0 0 1 1-1M3.693 8.388a1 1 0 0 1 .661 1.25a8 8 0 0 0-.156.583a1 1 0 0 1-1.95-.442q.084-.37.195-.73a1 1 0 0 1 1.25-.661",
  },
  fill: {
    d: "M11.463 2.891a1.5 1.5 0 0 1-1.131 1.795q-.277.063-.546.146A1.5 1.5 0 1 1 8.9 1.965q.378-.117.767-.205a1.5 1.5 0 0 1 1.795 1.131m1.074 0a1.5 1.5 0 0 1 1.795-1.13C19.008 2.82 22.5 7 22.5 12c0 5.799-4.701 10.5-10.5 10.5c-4.999 0-9.179-3.492-10.24-8.168a1.5 1.5 0 0 1 2.926-.664a7.5 7.5 0 1 0 8.982-8.982a1.5 1.5 0 0 1-1.13-1.795M6.98 4.381A1.5 1.5 0 0 1 6.9 6.5a8 8 0 0 0-.4.4a1.5 1.5 0 1 1-2.2-2.04q.27-.29.56-.56a1.5 1.5 0 0 1 2.12.08M12 5.5A1.5 1.5 0 0 1 13.5 7v4.379l2.56 2.56a1.5 1.5 0 1 1-2.12 2.122l-3-3A1.5 1.5 0 0 1 10.5 12V7A1.5 1.5 0 0 1 12 5.5M3.84 7.91a1.5 1.5 0 0 1 .992 1.876a8 8 0 0 0-.146.546a1.5 1.5 0 0 1-2.926-.664q.088-.39.205-.767a1.5 1.5 0 0 1 1.876-.991",
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
