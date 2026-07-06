import { getSvgPath } from "figma-squircle";
import type { CSSProperties } from "react";

export type SquircleStyleOptions = {
  cornerRadius: number;
  height: number;
  width: number;
  cornerSmoothing?: number;
};

export function createSquircleStyle({
  cornerRadius,
  cornerSmoothing = 1,
  height,
  width,
}: SquircleStyleOptions): CSSProperties {
  const path = getSvgPath({
    width,
    height,
    cornerRadius,
    cornerSmoothing,
  });

  return {
    borderRadius: cornerRadius,
    clipPath: `path('${path}')`,
    WebkitClipPath: `path('${path}')`,
  };
}

export { getSvgPath };
