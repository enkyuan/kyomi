"use client";

import { Toast } from "@base-ui/react/toast";
import type { ToastObject } from "@base-ui/react/toast";
import { useEffect, useState, type CSSProperties } from "react";
import type React from "react";
import { buttonVariants } from "../button";
import { cn } from "../../lib/utils";
import { ToastStatusIcon } from "./status-icon";
import { useToastSquircle } from "./use-toast-squircle";
import { getAnchorRect, type AnchoredToastData, type AnchorRect } from "./utils";

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
  const cornerRadius = tooltipStyle ? 8 : 14;
  const { squircleRef, squircleStyle } = useToastSquircle(cornerRadius);

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
          "relative text-balance border border-border bg-popover not-dark:bg-clip-padding text-popover-foreground text-xs transition-[scale,opacity] before:pointer-events-none before:absolute before:inset-0 before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 pointer-events-auto dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
          tooltipStyle ? "shadow-md/5" : "shadow-lg/5",
        )}
        data-slot="toast-popup"
        data-squircle={cornerRadius}
        ref={squircleRef}
        style={squircleStyle}
        toast={toast}
      >
        {tooltipStyle ? (
          <Toast.Content className="pointer-events-auto min-w-0 overflow-hidden px-2 py-1">
            <Toast.Title
              className="block min-w-0 truncate whitespace-nowrap"
              data-slot="toast-title"
            />
          </Toast.Content>
        ) : (
          <Toast.Content className="pointer-events-auto flex min-w-0 items-center justify-between gap-1.5 overflow-hidden px-3.5 py-3 text-sm">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <ToastStatusIcon toast={toast} />

              <Toast.Title
                className="block min-w-0 flex-1 truncate whitespace-nowrap font-medium"
                data-slot="toast-title"
              />
            </div>
            {toast.actionProps && (
              <Toast.Action
                className={cn(buttonVariants({ size: "xs" }), "shrink-0")}
                data-slot="toast-action"
              >
                {toast.actionProps.children}
              </Toast.Action>
            )}
          </Toast.Content>
        )}
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
