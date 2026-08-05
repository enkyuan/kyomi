import { hapticFor, maxLinesFor } from "./config";
import { styleToWire, type ToastColor, type ToastStyleOverride } from "./style";
import type {
  ToastActionRole,
  ToastHaptic,
  ToastPosition,
  ToastProgressStyle,
  ToastSemantic,
} from "./types";

/**
 * The single (at most one) action button on a toast. "At most one" is enforced
 * structurally by `Toast.action` being a single field rather than a list.
 *
 * The button is always rendered as a fully-rounded capsule natively. Its color
 * comes from `role` unless `color` is supplied. `onPressed` never crosses the
 * bridge — it stays in JS, keyed by toast id, and is invoked when native reports
 * the tap.
 */
export type ToastAction = {
  /** Hard color override; bypasses `role`-to-color derivation. */
  readonly color?: ToastColor;
  /**
   * If true (the default), the toast dismisses itself after the tap is delivered
   * (for an async `loadingOnPress` action, after `onPressed` resolves).
   */
  readonly dismissOnPress?: boolean;
  readonly label: string;
  /**
   * When true, pressing replaces the label with a spinner and keeps the toast up
   * until `onPressed` resolves. Then, if `dismissOnPress` is true (the default)
   * the toast dismisses; otherwise the spinner clears, the button returns to its
   * label, and auto-dismiss re-arms. Pair with an async `onPressed`.
   */
  readonly loadingOnPress?: boolean;
  /**
   * Invoked on the JS thread when native reports the tap. May be async; with
   * `loadingOnPress` the button shows a spinner until the returned promise
   * settles. Guarded by the engine so a throw can't poison the event stream.
   */
  readonly onPressed: () => Promise<void> | void;
  readonly role?: ToastActionRole;
};

/** Wire format for an action. `actionId` correlates a native `actionTapped`
 *  event back to `onPressed`; it is minted by the engine and validated to drop
 *  stale taps. */
export function actionToWire(action: ToastAction, actionId: string): Record<string, unknown> {
  const wire: Record<string, unknown> = {
    actionId,
    dismissOnPress: action.dismissOnPress ?? true,
    label: action.label,
    loadingOnPress: action.loadingOnPress ?? false,
    role: action.role ?? "primary",
  };
  if (action.color) wire.color = { dark: action.color.dark, light: action.color.light };
  return wire;
}

/**
 * An immutable description of a toast.
 *
 * A pure value type — no React context, no platform handles — so it is safe to
 * construct anywhere (services, stores, isolated business logic).
 *
 * `duration` is in **milliseconds**. `null` or `0` means persistent (requires
 * explicit dismissal); omitting it entirely means "use the app/semantic default",
 * which the engine resolves at show time.
 */
export type Toast = {
  /** At most one action button. */
  readonly action?: ToastAction;
  /**
   * `null` or `0` ⇒ persistent (requires explicit dismissal). Milliseconds.
   */
  readonly duration?: number | null;
  /**
   * De-dup / replace key. Showing a toast whose `groupKey` matches a live one
   * replaces it in place (morph) instead of stacking a duplicate.
   */
  readonly groupKey?: string;
  /** Haptic fired on appear. Undefined ⇒ derived from `semantic`. */
  readonly haptic?: ToastHaptic;
  /**
   * SF Symbol name (e.g. `"checkmark.circle.fill"`). When undefined, the symbol
   * is derived from `semantic` natively. An explicit value wins. On Android the
   * same names map to matching Material glyphs.
   */
  readonly icon?: string;
  /**
   * A base64-encoded raster image shown in the leading slot (a circular avatar /
   * thumbnail), in place of the SF Symbol. Wins over `icon` when set. Decoding —
   * and downsampling of large sources — happens off the main thread natively.
   */
  readonly leadingImage?: string;
  /** True for a persistent spinner toast. */
  readonly loading?: boolean;
  /**
   * Max lines for `message` before truncation. Undefined uses the semantic
   * fallback, which an app-wide value may replace at show time.
   */
  readonly maxLines?: number;
  /** Primary line. Truncated to `maxLines` natively. */
  readonly message: string;
  /** Tapping the toast body invokes this (in addition to any `tapToDismiss`). */
  readonly onTap?: () => void;
  /**
   * Where the toast anchors. Undefined ⇒ the app-wide default, resolved at show
   * time.
   */
  readonly position?: ToastPosition;
  /** Determinate progress 0.0–1.0 for upload-style toasts. Undefined ⇒ no bar. */
  readonly progress?: number;
  /**
   * How `progress` renders — a linear bar under the text or a circular ring in
   * the leading slot. Ignored when `progress` is undefined.
   */
  readonly progressStyle?: ToastProgressStyle;
  readonly semantic?: ToastSemantic;
  /** VoiceOver label. Falls back to `title` + `message` natively. */
  readonly semanticsLabel?: string;
  readonly style?: ToastStyleOverride;
  /** Whether tapping the toast body dismisses it. Defaults to true. */
  readonly tapToDismiss?: boolean;
  /** Optional bold line above `message`. */
  readonly title?: string;
  /** Max lines the `title` wraps to before truncating (default 1). */
  readonly titleMaxLines?: number;
  /**
   * Honored only for `topCenter` on Dynamic Island devices. Set false to keep
   * top-center placement but use a plain slide-in.
   */
  readonly useDynamicIslandOrigin?: boolean;
};

/**
 * True when the toast has no auto-dismiss deadline: a loading spinner, an
 * explicit `null` duration, or `0`.
 *
 * An **omitted** `duration` is NOT persistent — it means "use the default", which
 * the engine resolves to a concrete value before this is ever consulted on the
 * wire. (In Dart this distinction lived in a `_useDefault` sentinel; here the
 * optional field carries it.)
 */
export function isPersistent(toast: Toast): boolean {
  return toast.loading === true || toast.duration === null || toast.duration === 0;
}

/** Effective message line cap, before app-wide resolution. */
export function effectiveMaxLines(toast: Toast): number {
  return toast.maxLines ?? maxLinesFor(toast.semantic ?? "none");
}

/** Effective title line cap, before app-wide resolution. */
export function effectiveTitleMaxLines(toast: Toast): number {
  return toast.titleMaxLines ?? 1;
}

/**
 * Wire format. `actionId` is the id minted for `action` (omit when there is no
 * action). Colors serialize as `{light,dark}` maps; durations as ms.
 */
export function toastToWire(
  toast: Toast,
  id: string,
  actionId: string | undefined,
): Record<string, unknown> {
  const semantic = toast.semantic ?? "none";
  const loading = toast.loading === true;
  const persistent = isPersistent(toast);
  const wire: Record<string, unknown> = {
    hasTap: toast.onTap !== undefined,
    haptic: toast.haptic ?? hapticFor(semantic, loading),
    id,
    maxLines: effectiveMaxLines(toast),
    message: toast.message,
    persistent,
    position: toast.position ?? "topCenter",
    semantic,
    state: loading ? "loading" : "static",
    tapToDismiss: toast.tapToDismiss ?? true,
    titleMaxLines: effectiveTitleMaxLines(toast),
    useDynamicIslandOrigin: toast.useDynamicIslandOrigin ?? true,
  };
  if (toast.title !== undefined) wire.title = toast.title;
  if (toast.icon !== undefined) wire.icon = toast.icon;
  if (toast.leadingImage !== undefined) wire.image = toast.leadingImage;
  if (toast.style !== undefined) wire.style = styleToWire(toast.style, semantic);
  if (!persistent) wire.durationMs = toast.duration ?? 3000;
  if (toast.progress !== undefined) {
    wire.progress = toast.progress;
    wire.progressStyle = toast.progressStyle ?? "linear";
  }
  if (toast.groupKey !== undefined) wire.groupKey = toast.groupKey;
  if (toast.semanticsLabel !== undefined) wire.semanticsLabel = toast.semanticsLabel;
  if (toast.action !== undefined) {
    wire.action = actionToWire(toast.action, actionId ?? "a0");
  }
  return wire;
}
