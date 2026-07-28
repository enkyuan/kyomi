"use client";

import { Toast } from "@base-ui/react/toast";
import type { CSSProperties } from "react";
import type React from "react";
import { buttonVariants } from "../button";
import { cn } from "../../lib/utils";
import { AnchoredToasts } from "./anchored";
import { anchoredToastManager } from "./manager";
import { ToastStatusIcon } from "./status-icon";
import { useToastSquircle } from "./use-toast-squircle";

const TOAST_LAYER_Z_INDEX = 60;
const TOAST_VIEWPORT_STYLE = {
  zIndex: TOAST_LAYER_Z_INDEX,
} satisfies CSSProperties;

type SwipeDirection = "up" | "down" | "left" | "right";

type ToastManager = ReturnType<typeof Toast.createToastManager>;

function getSwipeDirection(position: ToastPosition): SwipeDirection[] {
  const verticalDirection: SwipeDirection = position.startsWith("top") ? "up" : "down";

  if (position.includes("center")) {
    return [verticalDirection];
  }

  if (position.includes("left")) {
    return ["left", verticalDirection];
  }

  return ["right", verticalDirection];
}

function Toasts({ position }: { position: ToastPosition }): React.ReactElement {
  const { toasts } = Toast.useToastManager();
  const swipeDirection = getSwipeDirection(position);

  return (
    <Toast.Portal data-slot="toast-portal">
      <Toast.Viewport
        className={cn(
          "fixed mx-auto flex w-[calc(100%-var(--toast-inset)*2)] max-w-90 [--toast-inset:--spacing(4)] sm:[--toast-inset:--spacing(8)]",
          // Vertical positioning
          "data-[position*=top]:top-(--toast-inset)",
          "data-[position*=bottom]:bottom-(--toast-inset)",
          // Horizontal positioning
          "data-[position*=left]:left-(--toast-inset)",
          "data-[position*=right]:right-(--toast-inset)",
          "data-[position*=center]:left-1/2 data-[position*=center]:-translate-x-1/2",
        )}
        data-position={position}
        data-slot="toast-viewport"
        style={TOAST_VIEWPORT_STYLE}
      >
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            position={position}
            swipeDirection={swipeDirection}
            toast={toast}
          />
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

function ToastItem({
  position,
  swipeDirection,
  toast,
}: {
  position: ToastPosition;
  swipeDirection: SwipeDirection[];
  toast: Toast.Root.Props["toast"];
}): React.ReactElement {
  const { squircleRef, squircleStyle } = useToastSquircle(14);

  return (
    <Toast.Root
      className={cn(
        "absolute z-[calc(9999-var(--toast-index))] h-(--toast-calc-height) w-fit max-w-full select-none border border-border bg-[color-mix(in_srgb,var(--popover),var(--color-black)_calc(1%*max(0,var(--toast-index,0))))] not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 [transition:transform_.2s_cubic-bezier(.22,1,.36,1),opacity_.2s,height_.15s,background-color_.15s] before:pointer-events-none before:absolute before:inset-0 before:shadow-[0_1px_--theme(--color-black/4%)] data-expanded:bg-popover dark:bg-[color-mix(in_srgb,var(--popover),var(--color-black)_calc(6%*max(0,var(--toast-index,0))))] dark:data-expanded:bg-popover dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        // Base positioning using data-position
        "data-[position*=right]:right-0 data-[position*=right]:left-auto",
        "data-[position*=left]:right-auto data-[position*=left]:left-0",
        "data-[position*=center]:right-0 data-[position*=center]:left-0 data-[position*=center]:mx-auto",
        "data-[position*=top]:top-0 data-[position*=top]:bottom-auto data-[position*=top]:origin-top",
        "data-[position*=bottom]:top-auto data-[position*=bottom]:bottom-0 data-[position*=bottom]:origin-bottom",
        // Gap fill for hover
        "after:absolute after:left-0 after:h-[calc(var(--toast-gap)+1px)] after:w-full",
        "data-[position*=top]:after:top-full",
        "data-[position*=bottom]:after:bottom-full",
        // Define some variables
        "[--toast-calc-height:var(--toast-frontmost-height,var(--toast-height))] [--toast-gap:--spacing(3)] [--toast-peek:--spacing(3)] [--toast-scale:calc(max(0,1-(var(--toast-index)*.1)))] [--toast-shrink:calc(1-var(--toast-scale))]",
        // Define offset-y variable
        "data-[position*=top]:[--toast-calc-offset-y:calc(var(--toast-offset-y)+var(--toast-index)*var(--toast-gap)+var(--toast-swipe-movement-y))]",
        "data-[position*=bottom]:[--toast-calc-offset-y:calc(var(--toast-offset-y)*-1+var(--toast-index)*var(--toast-gap)*-1+var(--toast-swipe-movement-y))]",
        // Default state transform
        "data-[position*=top]:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)+(var(--toast-index)*var(--toast-peek))+(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]",
        "data-[position*=bottom]:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--toast-peek))-(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]",
        // Limited state
        "data-limited:opacity-0",
        // Expanded state
        "data-expanded:h-(--toast-height)",
        "data-position:data-expanded:transform-[translateX(var(--toast-swipe-movement-x))_translateY(var(--toast-calc-offset-y))]",
        // Starting and ending animations
        "data-[position*=top]:data-starting-style:transform-[translateY(calc(-100%-var(--toast-inset)))]",
        "data-[position*=bottom]:data-starting-style:transform-[translateY(calc(100%+var(--toast-inset)))]",
        "data-ending-style:opacity-0",
        // Ending animations (direction-aware)
        "data-ending-style:not-data-limited:not-data-swipe-direction:transform-[translateY(calc(100%+var(--toast-inset)))]",
        "data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-100%-var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
        "data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+100%+var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
        "data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-100%-var(--toast-inset)))]",
        "data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+100%+var(--toast-inset)))]",
        // Ending animations (expanded)
        "data-expanded:data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-100%-var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+100%+var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-100%-var(--toast-inset)))]",
        "data-expanded:data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+100%+var(--toast-inset)))]",
      )}
      data-position={position}
      data-slot="toast-popup"
      data-squircle="14"
      ref={squircleRef}
      style={squircleStyle}
      swipeDirection={swipeDirection}
      toast={toast}
    >
      <Toast.Content className="pointer-events-auto flex min-w-0 items-center justify-between gap-1.5 overflow-hidden px-3.5 py-3 text-sm transition-opacity duration-150 data-behind:not-data-expanded:pointer-events-none data-behind:opacity-0 data-expanded:opacity-100">
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
    </Toast.Root>
  );
}

export const toastManager: ToastManager = Toast.createToastManager();
export { anchoredToastManager } from "./manager";

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface ToastProviderProps extends Toast.Provider.Props {
  position?: ToastPosition;
}

export function ToastProvider({
  children,
  position = "bottom-right",
  ...props
}: ToastProviderProps): React.ReactElement {
  return (
    <Toast.Provider toastManager={toastManager} {...props}>
      {children}
      <Toasts position={position} />
    </Toast.Provider>
  );
}

export function AnchoredToastProvider({
  children,
  ...props
}: Toast.Provider.Props): React.ReactElement {
  return (
    <Toast.Provider toastManager={anchoredToastManager} {...props}>
      {children}
      <AnchoredToasts />
    </Toast.Provider>
  );
}

export { Toast as ToastPrimitive };
