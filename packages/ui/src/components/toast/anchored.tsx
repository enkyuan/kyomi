"use client";

import { Toast } from "@base-ui/react/toast";
import type { ToastObject } from "@base-ui/react/toast";
import { useEffect, useState, type CSSProperties } from "react";
import type React from "react";
import { cn } from "../../lib/utils";
import { TOAST_CONTENT_CLASS_NAME, ToastRow } from "./row";
import { ToastSurface } from "./surface";
import { ToastTitle } from "./text";
import { getAnchorRect, type AnchoredToastData, type AnchorRect } from "./utils";

/** Corner radii of the two anchored shapes; keep in step with `--toast-radius` below. */
const TOOLTIP_RADIUS_PX = 10;
const CARD_RADIUS_PX = 14;

const ANCHORED_TOAST_VIEWPORT_STYLE = {
  pointerEvents: "none",
  zIndex: 60,
} satisfies CSSProperties;

function useAnchorRect(anchor: Element | null | undefined): AnchorRect | null {
  const [rect, setRect] = useState<AnchorRect | null>(() => getAnchorRect(anchor));

  useEffect(() => {
    const update = () => setRect(getAnchorRect(anchor));

    update();

    if (!anchor?.isConnected) {
      return undefined;
    }

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    resizeObserver?.observe(anchor);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor]);

  return rect;
}

function getToastAnchorStyle(
  rect: AnchorRect,
  positionerProps: ToastObject<Record<string, unknown>>["positionerProps"] | undefined,
): CSSProperties {
  const side = positionerProps?.side ?? "top";
  const sideOffset =
    typeof positionerProps?.sideOffset === "number" ? positionerProps.sideOffset : 4;
  const position = positionerProps?.positionMethod ?? "fixed";
  const scrollLeft = position === "absolute" ? window.scrollX : 0;
  const scrollTop = position === "absolute" ? window.scrollY : 0;

  return {
    left: rect.left + rect.width / 2 + scrollLeft,
    pointerEvents: "none",
    position,
    top: (side === "bottom" ? rect.bottom + sideOffset : rect.top - sideOffset) + scrollTop,
    transform: side === "bottom" ? "translateX(-50%)" : "translate(-50%, -100%)",
    zIndex: 60,
  };
}

function AnchoredToastItem({
  toast,
}: {
  toast: ToastObject<Record<string, unknown>>;
}): React.ReactElement | null {
  const toastData = toast.data as AnchoredToastData | undefined;
  const tooltipStyle = toastData?.tooltipStyle ?? false;
  const positionerProps = toast.positionerProps;
  const liveAnchorRect = useAnchorRect(positionerProps?.anchor);
  const anchorRect = liveAnchorRect ?? toastData?.anchorRect ?? null;

  if (!anchorRect) {
    return null;
  }

  const { className, sideOffset, style, ...basePositionerProps } = positionerProps ?? {};
  const positionerClassName = typeof className === "string" ? className : undefined;
  const positionerStyle = {
    ...(style as CSSProperties | undefined),
    ...getToastAnchorStyle(anchorRect, positionerProps),
  } satisfies CSSProperties;

  return (
    <Toast.Positioner
      {...basePositionerProps}
      className={cn(
        "z-[60] max-w-[min(--spacing(64),var(--available-width))]",
        positionerClassName,
      )}
      data-slot="toast-positioner"
      sideOffset={sideOffset ?? 4}
      style={positionerStyle}
      toast={toast}
    >
      <Toast.Root
        className={cn(
          "group/toast pointer-events-auto relative text-popover-foreground text-xs shadow-(--glass-shadow) transition-[scale,box-shadow] data-ending-style:scale-98 data-ending-style:shadow-none data-starting-style:scale-98 data-starting-style:shadow-none",
          tooltipStyle
            ? "rounded-(--toast-radius) [--toast-radius:10px]"
            : "rounded-(--toast-radius) [--toast-inset:6px] [--toast-radius:14px]",
        )}
        data-slot="toast-popup"
        toast={toast}
      >
        <ToastSurface
          className="transition-opacity duration-(--duration-control) group-data-ending-style/toast:opacity-0 group-data-starting-style/toast:opacity-0"
          radius={tooltipStyle ? TOOLTIP_RADIUS_PX : CARD_RADIUS_PX}
        >
          {tooltipStyle ? (
            <Toast.Content className="pointer-events-auto px-2 py-1">
              <ToastTitle
                className="truncate font-medium"
                data-slot="toast-title"
                maxMorphChars={36}
                toast={toast}
              />
            </Toast.Content>
          ) : (
            <Toast.Content className={TOAST_CONTENT_CLASS_NAME}>
              <ToastRow maxMorphChars={28} toast={toast} />
            </Toast.Content>
          )}
        </ToastSurface>
      </Toast.Root>
    </Toast.Positioner>
  );
}

export function AnchoredToasts(): React.ReactElement {
  const { toasts } = Toast.useToastManager();

  return (
    <Toast.Portal data-slot="toast-portal-anchored">
      <Toast.Viewport
        className="fixed inset-0 outline-none"
        data-slot="toast-viewport-anchored"
        style={ANCHORED_TOAST_VIEWPORT_STYLE}
      >
        {toasts.map((toast) => (
          <AnchoredToastItem key={toast.id} toast={toast} />
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}
