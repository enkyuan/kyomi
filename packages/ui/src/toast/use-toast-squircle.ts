"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createSquircleStyle } from "../lib/squircle";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type ToastSize = {
  height: number;
  width: number;
};

export function useToastSquircle(cornerRadius: number) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [size, setSize] = useState<ToastSize>({ height: 0, width: 0 });

  useIsomorphicLayoutEffect(() => {
    if (!node) {
      return undefined;
    }

    const updateSize = () => {
      const nextSize = {
        height: node.offsetHeight,
        width: node.offsetWidth,
      };

      setSize((currentSize) =>
        currentSize.height === nextSize.height && currentSize.width === nextSize.width
          ? currentSize
          : nextSize,
      );
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, [node]);

  const style = useMemo(
    () =>
      size.height > 0 && size.width > 0
        ? createSquircleStyle({
            cornerRadius,
            cornerSmoothing: 1,
            height: size.height,
            width: size.width,
          })
        : { borderRadius: cornerRadius },
    [cornerRadius, size.height, size.width],
  );

  return {
    squircleRef: setNode,
    squircleStyle: style,
  };
}
