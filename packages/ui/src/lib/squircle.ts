import { getSvgPath } from "figma-squircle";
import { type CSSProperties, useEffect, useRef, useState } from "react";

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

export function useSquircle<T extends HTMLElement = HTMLElement>(
  cornerRadius: number,
  cornerSmoothing = 1,
) {
  const ref = useRef<T | null>(null);
  const [style, setStyle] = useState<CSSProperties>({
    borderRadius: cornerRadius,
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const { offsetWidth, offsetHeight } = element;
      if (offsetWidth > 0 && offsetHeight > 0) {
        setStyle(
          createSquircleStyle({
            width: offsetWidth,
            height: offsetHeight,
            cornerRadius,
            cornerSmoothing,
          }),
        );
      }
    };

    update();

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(update);
      observer.observe(element);
      return () => observer.disconnect();
    }
  }, [cornerRadius, cornerSmoothing]);

  return { ref, style };
}

export { getSvgPath };
