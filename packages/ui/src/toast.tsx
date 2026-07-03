"use client";

import { Toast } from "@base-ui/react/toast";
import type { ToastObject } from "@base-ui/react/toast";
import {
  AlertFill,
  CheckCircleFill,
  InformationFill,
  LoadingFill,
  WarningFill,
} from "@mingcute/react";
import { useEffect, useState, type CSSProperties } from "react";
import type React from "react";
import { cn } from "./lib/utils";
import { buttonVariants } from "./button";

const TOAST_ICONS = {
  error: AlertFill,
  info: InformationFill,
  loading: LoadingFill,
  success: CheckCircleFill,
  warning: WarningFill,
} as const;
const TOAST_LAYER_Z_INDEX = 60;
const TOAST_VIEWPORT_STYLE = {
  zIndex: TOAST_LAYER_Z_INDEX,
} satisfies CSSProperties;
const ANCHORED_TOAST_VIEWPORT_STYLE = {
  pointerEvents: "none",
  zIndex: TOAST_LAYER_Z_INDEX,
} satisfies CSSProperties;

type ToastProgressData = {
  progress?: {
    value: number;
    max: number;
    label?: string;
  };
};

function getToastProgress(
  toast: ToastObject<Record<string, unknown>>,
): ToastProgressData["progress"] | null {
  const progress = (toast.data as ToastProgressData | undefined)?.progress;
  if (!progress || !Number.isFinite(progress.value) || !Number.isFinite(progress.max)) {
    return null;
  }
  if (progress.max <= 0) {
    return null;
  }
  return progress;
}

function ToastProgressIcon({
  progress,
}: {
  progress: NonNullable<ToastProgressData["progress"]>;
}): React.ReactElement {
  const max = Math.max(1, progress.max);
  const value = Math.min(Math.max(progress.value, 0), max);
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / max) * circumference;

  return (
    <div className="grid h-4 w-4 shrink-0 place-items-center text-muted-foreground">
      <progress
        aria-label={progress.label ?? "Import progress"}
        className="sr-only"
        max={max}
        value={value}
      />
      <svg aria-hidden="true" className="h-4 w-4 -rotate-90" viewBox="0 0 18 18">
        <circle
          className="opacity-20"
          cx="9"
          cy="9"
          fill="none"
          r={radius}
          stroke="currentColor"
          strokeWidth="2"
        />
        <circle
          className="transition-[stroke-dashoffset] duration-300 ease-out"
          cx="9"
          cy="9"
          fill="none"
          r={radius}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="2"
        />
      </svg>
    </div>
  );
}

function ToastStatusIcon({
  toast,
}: {
  toast: ToastObject<Record<string, unknown>>;
}): React.ReactElement | null {
  const progress = getToastProgress(toast);
  if (progress) {
    return (
      <div data-slot="toast-icon">
        <ToastProgressIcon progress={progress} />
      </div>
    );
  }

  const Icon = toast.type ? TOAST_ICONS[toast.type as keyof typeof TOAST_ICONS] : null;
  if (!Icon) {
    return null;
  }

  const iconColor = toastMingcuteIconColor(toast.type);
  const iconClass = toastMingcuteIconClassName(toast.type);

  return (
    <div
      className="[&>svg]:h-lh [&>svg]:w-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"
      data-slot="toast-icon"
    >
      <Icon className={cn("h-4 w-4 shrink-0", iconClass)} color={iconColor} />
    </div>
  );
}

/**
 * Mingcute icons set `style={{ color: "currentColor" }}` on the root SVG, which wins over
 * `text-*` utilities and resolves `currentColor` from the toast surface (popover text), so
 * semantic tints never apply. Pass explicit theme colors via the `color` prop instead.
 */
function toastMingcuteIconColor(type: string | undefined): string {
  switch (type) {
    case "error":
      return "var(--color-destructive)";
    case "success":
      return "var(--color-success)";
    case "info":
      return "var(--color-info)";
    case "warning":
      return "var(--color-warning)";
    case "loading":
      return "var(--color-muted-foreground)";
    default:
      return "var(--color-muted-foreground)";
  }
}

function toastMingcuteIconClassName(type: string | undefined): string {
  return type === "loading" ? "animate-spin opacity-90" : "";
}

type SwipeDirection = "up" | "down" | "left" | "right";

type AnchorRect = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

type AnchoredToastData = {
  anchorRect?: AnchorRect;
  tooltipStyle?: boolean;
};

type ToastManager = ReturnType<typeof Toast.createToastManager>;
type ToastInput = Parameters<ToastManager["add"]>[0];

function getAnchorRect(anchor: Element | null | undefined): AnchorRect | null {
  if (!anchor?.isConnected) {
    return null;
  }

  const rect = anchor.getBoundingClientRect();

  return {
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    top: rect.top,
    width: rect.width,
  };
}

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
    zIndex: TOAST_LAYER_Z_INDEX,
  };
}

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
        {toasts.map((toast) => {
          return (
            <Toast.Root
              className={cn(
                "absolute z-[calc(9999-var(--toast-index))] h-(--toast-calc-height) w-full select-none rounded-lg border border-border bg-[color-mix(in_srgb,var(--popover),var(--color-black)_calc(1%*max(0,var(--toast-index,0))))] not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 [transition:transform_.2s_cubic-bezier(.22,1,.36,1),opacity_.2s,height_.15s,background-color_.15s] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-expanded:bg-popover dark:bg-[color-mix(in_srgb,var(--popover),var(--color-black)_calc(6%*max(0,var(--toast-index,0))))] dark:data-expanded:bg-popover dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
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
              key={toast.id}
              swipeDirection={swipeDirection}
              toast={toast}
            >
              <Toast.Content className="pointer-events-auto flex items-center justify-between gap-1.5 overflow-hidden px-3.5 py-3 text-sm transition-opacity duration-150 data-behind:not-data-expanded:pointer-events-none data-behind:opacity-0 data-expanded:opacity-100">
                <div className="flex gap-2">
                  <ToastStatusIcon toast={toast} />

                  <div className="flex flex-col gap-0.5">
                    <Toast.Title className="font-medium" data-slot="toast-title" />
                    <Toast.Description
                      className="text-muted-foreground"
                      data-slot="toast-description"
                    />
                  </div>
                </div>
                {toast.actionProps && (
                  <Toast.Action className={buttonVariants({ size: "xs" })} data-slot="toast-action">
                    {toast.actionProps.children}
                  </Toast.Action>
                )}
              </Toast.Content>
            </Toast.Root>
          );
        })}
      </Toast.Viewport>
    </Toast.Portal>
  );
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
          "relative text-balance border border-border bg-popover not-dark:bg-clip-padding text-popover-foreground text-xs transition-[scale,opacity] before:pointer-events-none before:absolute before:inset-0 before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 pointer-events-auto dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
          tooltipStyle
            ? "rounded-md shadow-md/5 before:rounded-[calc(var(--radius-md)-1px)]"
            : "rounded-lg shadow-lg/5 before:rounded-[calc(var(--radius-lg)-1px)]",
        )}
        data-slot="toast-popup"
        toast={toast}
      >
        {tooltipStyle ? (
          <Toast.Content className="pointer-events-auto px-2 py-1">
            <Toast.Title data-slot="toast-title" />
          </Toast.Content>
        ) : (
          <Toast.Content className="pointer-events-auto flex items-center justify-between gap-1.5 overflow-hidden px-3.5 py-3 text-sm">
            <div className="flex gap-2">
              <ToastStatusIcon toast={toast} />

              <div className="flex flex-col gap-0.5">
                <Toast.Title className="font-medium" data-slot="toast-title" />
                <Toast.Description
                  className="text-muted-foreground"
                  data-slot="toast-description"
                />
              </div>
            </div>
            {toast.actionProps && (
              <Toast.Action className={buttonVariants({ size: "xs" })} data-slot="toast-action">
                {toast.actionProps.children}
              </Toast.Action>
            )}
          </Toast.Content>
        )}
      </Toast.Root>
    </Toast.Positioner>
  );
}

function snapshotAnchoredToastInput(toast: ToastInput): ToastInput {
  const anchorRect = getAnchorRect(toast.positionerProps?.anchor);
  if (!anchorRect) {
    return toast;
  }

  return {
    ...toast,
    data: {
      ...toast.data,
      anchorRect,
    },
  };
}

function createAnchoredToastManager(): ToastManager {
  const manager = Toast.createToastManager();
  const add = manager.add.bind(manager);
  manager.add = ((toast: ToastInput) =>
    add(snapshotAnchoredToastInput(toast))) as ToastManager["add"];
  return manager;
}

function AnchoredToasts(): React.ReactElement {
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

export const toastManager: ToastManager = Toast.createToastManager();
export const anchoredToastManager: ToastManager = createAnchoredToastManager();

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
