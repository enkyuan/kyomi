/* oxlint-disable react-doctor/only-export-components */
"use client";

import { Toast } from "@base-ui/react/toast";
import type { CSSProperties } from "react";
import type React from "react";
import { cn } from "../../lib/utils";
import { AnchoredToasts } from "./anchored";
import { anchoredToastManager, type ToastManager } from "./manager";
import { TOAST_CONTENT_CLASS_NAME, ToastRow } from "./row";
import { ToastSurface } from "./surface";

const TOAST_LAYER_Z_INDEX = 60;
const TOAST_VIEWPORT_STYLE = {
  zIndex: TOAST_LAYER_Z_INDEX,
} satisfies CSSProperties;

type SwipeDirection = "up" | "down" | "left" | "right";

/** Outer corner radius of a toast; keep in step with `--toast-radius` on the root below. */
const TOAST_RADIUS_PX = 14;

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
          "data-[position*=bottom]:bottom-[max(var(--toast-inset),env(safe-area-inset-bottom,0px))]",
          // Horizontal positioning
          "data-[position*=left]:left-(--toast-inset)",
          "data-[position*=right]:right-(--toast-inset)",
          "data-[position*=center]:left-1/2 data-[position*=center]:-translate-x-1/2",
        )}
        data-position={position}
        data-slot="toast-viewport"
        style={TOAST_VIEWPORT_STYLE}
      >
        {toasts.map((toast) => {
          return (
            <Toast.Root
              className={cn(
                "group/toast absolute z-[calc(9999-var(--toast-index))] h-(--toast-calc-height) w-full select-none rounded-(--toast-radius) text-popover-foreground shadow-(--glass-shadow) [--toast-inset:6px] [--toast-radius:14px] [--toast-shade:calc(1%*max(0,var(--toast-index,0)))] [transition:transform_.2s_var(--ease-out-quint),box-shadow_.2s,height_.15s] data-expanded:[--toast-shade:0%] dark:[--toast-shade:calc(6%*max(0,var(--toast-index,0)))] dark:data-expanded:[--toast-shade:0%]",
                // Base positioning using data-position
                "data-[position*=right]:right-0 data-[position*=right]:left-auto",
                "data-[position*=left]:right-auto data-[position*=left]:left-0",
                "data-[position*=center]:right-0 data-[position*=center]:left-0",
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
                // Limited state: the surface fades, so the shadow goes with it
                "data-limited:shadow-none",
                // Expanded state
                "data-expanded:h-(--toast-height)",
                "data-position:data-expanded:transform-[translateX(var(--toast-swipe-movement-x))_translateY(var(--toast-calc-offset-y))]",
                // Starting and ending animations
                "data-[position*=top]:data-starting-style:transform-[translateY(calc(-100%-var(--toast-inset)))]",
                "data-[position*=bottom]:data-starting-style:transform-[translateY(calc(100%+var(--toast-inset)))]",
                "data-ending-style:shadow-none",
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
              key={toast.id}
              swipeDirection={swipeDirection}
              toast={toast}
            >
              <ToastSurface
                className="size-full transition-opacity duration-200 group-data-ending-style/toast:opacity-0 group-data-limited/toast:opacity-0"
                radius={TOAST_RADIUS_PX}
              >
                <Toast.Content className={TOAST_CONTENT_CLASS_NAME}>
                  <ToastRow toast={toast} />
                </Toast.Content>
              </ToastSurface>
            </Toast.Root>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
}

export const toastManager: ToastManager = Toast.createToastManager();
export { anchoredToastManager } from "./manager";
export type { ToastLine, ToastManager } from "./manager";

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

// The managers are Base UI's own, typed to refuse a description; the provider takes the wider type.
type ProviderManager = Toast.Provider.Props["toastManager"];

export interface ToastProviderProps extends Toast.Provider.Props {
  position?: ToastPosition;
}

export function ToastProvider({
  children,
  position = "bottom-right",
  ...props
}: ToastProviderProps): React.ReactElement {
  return (
    <Toast.Provider toastManager={toastManager as ProviderManager} {...props}>
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
    <Toast.Provider toastManager={anchoredToastManager as ProviderManager} {...props}>
      {children}
      <AnchoredToasts />
    </Toast.Provider>
  );
}

export { Toast as ToastPrimitive };
