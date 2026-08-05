/**
 * Wire-level enums and value types. Every string here is the **wire contract** —
 * the exact same literal appears in `Models.swift` and `Models.kt`, matched by
 * value. Changing one means changing all three.
 */

/** Built-in semantic intent. Drives the default icon and color natively. */
export type ToastSemantic = "error" | "info" | "none" | "success" | "warning";

/**
 * Glass rendering intent. The actual decision (native Liquid Glass on iOS 26+ vs
 * a frosted-material fallback below) is made **at render time on-device**; JS
 * only expresses intent. `adaptive` is the right default everywhere.
 */
export type ToastGlass = "adaptive" | "frosted" | "liquid" | "none" | "solid";

/** Haptic fired when a toast appears. Derived from the semantic when unset. */
export type ToastHaptic = "error" | "none" | "selection" | "success" | "warning";

/**
 * How a determinate progress value renders.
 *
 * - `linear` — a horizontal bar under the text.
 * - `circular` — a compact determinate ring in the leading slot, in place of
 *   the icon (an upload/download-style indicator).
 */
export type ToastProgressStyle = "circular" | "linear";

/**
 * An animated SF Symbol effect applied to the toast's icon (iOS only; the glyph
 * renders statically on Android).
 *
 * - `bounce` fires once when the icon appears.
 * - `pulse`, `variableColor` loop while visible (iOS 17+).
 * - `wiggle`, `rotate`, `breathe` loop while visible (iOS 18+; fall back to
 *   `pulse` on iOS 17).
 * - `drawOn` traces the symbol on as it appears (iOS 26+; falls back to
 *   `bounce` below). Best on stroke-based symbols.
 */
export type ToastSymbolEffect =
  | "bounce"
  | "breathe"
  | "drawOn"
  | "none"
  | "pulse"
  | "rotate"
  | "variableColor"
  | "wiggle";

/**
 * Where a toast anchors on screen.
 *
 * The **Dynamic Island origin** animation is only used for `topCenter` on
 * devices that have a Dynamic Island (and in portrait). Every other position —
 * and `topCenter` on notch / home-button devices — uses a standard slide-in.
 */
export type ToastPosition =
  | "bottomCenter"
  | "bottomLeading"
  | "bottomTrailing"
  | "center"
  | "topCenter"
  | "topLeading"
  | "topTrailing";

/** Semantic role of a toast's action button; the color is derived natively. */
export type ToastActionRole =
  | "destructive"
  | "neutral"
  | "primary"
  | "secondary"
  | "success"
  | "warning";

/** What to drop when more toasts are queued than the stack can hold. */
export type ToastDropPolicy = "dropNewest" | "dropOldest";

/** Why a toast left the screen. Wire strings are identical on all sides. */
export type ToastDismissReason =
  /** Auto-dismiss duration elapsed. */
  | "timeout"
  /** Programmatic dismissal (`dismiss` / handle.dismiss). */
  | "manual"
  /** User swiped the toast away. */
  | "swipe"
  /** Dismissed as a side effect of the action button (`dismissOnPress`). */
  | "action"
  /** Dismissed by tapping the toast body (`tapToDismiss`). */
  | "tap"
  /** Replaced in place by a same-`groupKey` toast. */
  | "replaced"
  /** Cleared by `dismissAll`. */
  | "dismissAll"
  /** Torn down because the app was backgrounded past the deadline. */
  | "appBackgrounded"
  /** The native event bridge was lost; resolved fail-safe on the JS side. */
  | "channelLost"
  /** Native flushed all toasts (e.g. a fast-refresh handshake). */
  | "systemReset"
  | "unknown";

/** Kind of native → JS event. */
export type ToastEventKind = "action" | "dismissed" | "shown" | "tap" | "unknown";

/** A native → JS lifecycle event for a single toast, routed by `id`. */
export type ToastEvent = {
  /** Set for `action`; echoes the action id sent at show time. */
  readonly actionId?: string;
  readonly id: string;
  readonly kind: ToastEventKind;
  /** Set for `dismissed`. */
  readonly reason: ToastDismissReason;
  /** Set for `shown`. */
  readonly stackIndex?: number;
};

const DISMISS_REASONS = new Set<string>([
  "timeout",
  "manual",
  "swipe",
  "action",
  "tap",
  "replaced",
  "dismissAll",
  "appBackgrounded",
  "channelLost",
  "systemReset",
]);

/** Maps a wire reason string to a {@link ToastDismissReason}. */
export function reasonFromWire(value: string | undefined): ToastDismissReason {
  return value !== undefined && DISMISS_REASONS.has(value)
    ? (value as ToastDismissReason)
    : "unknown";
}

/** Maps a wire event string to a {@link ToastEventKind}. */
export function kindFromWire(value: string | undefined): ToastEventKind {
  switch (value) {
    case "actionTapped":
      return "action";
    case "dismissed":
      return "dismissed";
    case "shown":
      return "shown";
    case "tapped":
      return "tap";
    default:
      return "unknown";
  }
}
