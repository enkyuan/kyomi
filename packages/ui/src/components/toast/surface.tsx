"use client";

import { useId } from "react";
import type React from "react";
import { useSquircle } from "../../lib/squircle";
import { cn } from "../../lib/utils";

interface ToastSurfaceProps extends React.ComponentProps<"div"> {
  /** Outer corner radius in px; the squircle path is measured from the element's size. */
  radius: number;
}

/**
 * The frosted-glass body of a toast: the glass tokens (`--glass*` in theme.css) blurred over what
 * is behind, clipped to a squircle. A clip path cuts a border and a shadow, so the 1px edge is
 * stroked along the same path (twice as wide, the outer half clipped away) and the shadow sits on
 * the toast root, outside the clip.
 *
 * The surface carries its own fades: an ancestor with `opacity` below 1 would become the
 * backdrop root and the blur would sample nothing but the toast itself. A stacked toast sets
 * `--toast-shade` to darken itself a little for each toast in front of it.
 */
export function ToastSurface({
  radius,
  className,
  children,
  style,
  ...props
}: ToastSurfaceProps): React.ReactElement {
  const squircle = useSquircle<HTMLDivElement>(radius, 1);
  const gradientId = `toast-edge-${useId().replaceAll(":", "")}`;

  return (
    <div
      {...props}
      className={cn(
        "relative bg-[color-mix(in_srgb,var(--glass),var(--color-black)_var(--toast-shade,0%))] bg-linear-to-b from-(--glass-sheen) to-transparent backdrop-blur-(--glass-blur) backdrop-saturate-(--glass-saturate)",
        className,
      )}
      data-slot="toast-surface"
      ref={squircle.ref}
      style={{ ...style, ...squircle.style }}
    >
      {squircle.path ? (
        <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--glass-highlight)" }} />
              <stop offset="1" style={{ stopColor: "var(--glass-edge)" }} />
            </linearGradient>
          </defs>
          <path d={squircle.path} fill="none" stroke={`url(#${gradientId})`} strokeWidth={2} />
        </svg>
      ) : null}
      {children}
    </div>
  );
}
