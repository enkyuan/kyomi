import type { SVGProps } from "react";
import { GoogleIconGeometry } from "./google-geometry";

export type GoogleIconProps = Omit<SVGProps<SVGSVGElement>, "height" | "width"> & {
  size?: number;
};

export function GoogleIcon({ size = 20, ...props }: GoogleIconProps) {
  return (
    <svg
      {...props}
      aria-hidden="true"
      focusable="false"
      height={size}
      viewBox={GoogleIconGeometry.viewBox}
      width={size}
    >
      {GoogleIconGeometry.paths.map((path) => (
        <path d={path.d} fill={path.fill} key={path.d} />
      ))}
    </svg>
  );
}
