"use client";

import { getSvgPath } from "figma-squircle";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ComponentProps,
  type Key,
  type ReactElement,
  type ReactNode,
  type Ref,
} from "react";
import { cn } from "./lib/utils";

export type FaviconShape = "rounded" | "squircle";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type FaviconImageProps = Omit<ComponentProps<"img">, "alt" | "className" | "ref" | "src">;

export type FaviconProps = Omit<ComponentProps<"span">, "children" | "ref" | "title"> & {
  ref?: Ref<HTMLSpanElement>;
  src?: string | null;
  title: string;
  alt?: string;
  shape?: FaviconShape;
  cornerRadius?: number;
  cornerSmoothing?: number;
  fallback?: ReactNode;
  fallbackClassName?: string;
  imageClassName?: string;
  imageKey?: Key;
  imageProps?: FaviconImageProps;
  imageRef?: Ref<HTMLImageElement>;
  loading?: boolean;
  loadingClassName?: string;
};

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (!ref) return;

  if (typeof ref === "function") {
    ref(value);
    return;
  }

  (ref as { current: T | null }).current = value;
}

function createSquircleMaskUrl(path: string, width: number, height: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><path fill="black" d="${path}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export function Favicon({
  ref,
  src,
  title,
  alt = `${title} favicon`,
  shape = "squircle",
  cornerRadius = 6,
  cornerSmoothing = 1,
  fallback,
  fallbackClassName,
  imageClassName,
  imageKey,
  imageProps,
  imageRef,
  loading = false,
  loadingClassName,
  className,
  style,
  ...props
}: FaviconProps): ReactElement {
  const [wrapper, setWrapper] = useState<HTMLSpanElement | null>(null);
  const [wrapperSize, setWrapperSize] = useState({ width: 0, height: 0 });

  const setWrapperNode = useCallback(
    (node: HTMLSpanElement | null) => {
      setWrapper(node);
      assignRef(ref, node);
    },
    [ref],
  );

  useIsomorphicLayoutEffect(() => {
    if (shape !== "squircle" || !wrapper) {
      return;
    }

    const updateSize = () => {
      setWrapperSize((current) => {
        const next = { width: wrapper.offsetWidth, height: wrapper.offsetHeight };
        return current.width === next.width && current.height === next.height ? current : next;
      });
    };

    updateSize();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateSize);
    observer.observe(wrapper);

    return () => observer.disconnect();
  }, [shape, wrapper]);

  const squirclePath = useMemo(() => {
    if (shape !== "squircle" || wrapperSize.width <= 0 || wrapperSize.height <= 0) {
      return undefined;
    }

    return getSvgPath({
      width: wrapperSize.width,
      height: wrapperSize.height,
      cornerRadius,
      cornerSmoothing,
    });
  }, [cornerRadius, cornerSmoothing, shape, wrapperSize.height, wrapperSize.width]);

  const squircleMaskUrl = useMemo(() => {
    if (!squirclePath) {
      return undefined;
    }

    return createSquircleMaskUrl(squirclePath, wrapperSize.width, wrapperSize.height);
  }, [squirclePath, wrapperSize.height, wrapperSize.width]);

  const squircleStyle =
    shape === "squircle"
      ? ({
          borderRadius: cornerRadius,
          clipPath: squirclePath ? `path('${squirclePath}')` : undefined,
          WebkitClipPath: squirclePath ? `path('${squirclePath}')` : undefined,
          maskImage: squircleMaskUrl,
          maskRepeat: "no-repeat",
          maskSize: "100% 100%",
          WebkitMaskImage: squircleMaskUrl,
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskSize: "100% 100%",
        } satisfies CSSProperties)
      : undefined;

  return (
    <span
      aria-label={src ? undefined : alt}
      data-shape={shape}
      data-slot="favicon"
      data-squircle={shape === "squircle" ? cornerRadius : undefined}
      data-loading={loading ? "" : undefined}
      ref={setWrapperNode}
      role={src ? undefined : "img"}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
        className,
      )}
      style={{ ...squircleStyle, ...style }}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className={cn("absolute inset-0 rounded-[inherit] bg-muted/60", loadingClassName)}
          data-slot="favicon-loading"
          style={squircleStyle}
        />
      ) : null}
      {fallback && (!src || loading) ? (
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-[20%] flex size-[60%] items-center justify-center text-muted-foreground/80",
            fallbackClassName,
          )}
          data-slot="favicon-fallback"
        >
          {fallback}
        </span>
      ) : null}
      {src ? (
        <img
          alt={alt}
          className={cn(
            "absolute inset-0 size-full rounded-[inherit] object-contain transition-opacity duration-150",
            loading ? "opacity-0" : "opacity-100",
            imageClassName,
          )}
          data-slot="favicon-image"
          key={imageKey}
          ref={imageRef}
          src={src}
          {...imageProps}
        />
      ) : null}
    </span>
  );
}
