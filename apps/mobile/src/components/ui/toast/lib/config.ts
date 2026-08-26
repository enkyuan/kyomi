import type {
  ToastDropPolicy,
  ToastGlass,
  ToastHaptic,
  ToastPosition,
  ToastSemantic,
} from "./types";

/**
 * Single source of truth for per-semantic presentation defaults.
 *
 * Used by the semantic show methods, the engine's show-time duration resolution,
 * and the wire haptic derivation — so each default lives in exactly one place
 * instead of drifting across call signatures. Durations are in milliseconds.
 */
export const SEMANTIC_DEFAULTS = {
  errorDuration: 4000,
  infoDuration: 3000,
  plainDuration: 3000,
  successDuration: 3000,
  warningDuration: 3000,
} as const;

/**
 * Auto-dismiss duration (ms) when neither the caller nor the app config sets one.
 * Errors linger a beat longer so they can be read.
 */
export function durationFor(semantic: ToastSemantic): number {
  switch (semantic) {
    case "error":
      return SEMANTIC_DEFAULTS.errorDuration;
    case "info":
      return SEMANTIC_DEFAULTS.infoDuration;
    case "success":
      return SEMANTIC_DEFAULTS.successDuration;
    case "warning":
      return SEMANTIC_DEFAULTS.warningDuration;
    default:
      return SEMANTIC_DEFAULTS.plainDuration;
  }
}

/** Message line cap: errors and warnings get room to explain themselves. */
export function maxLinesFor(semantic: ToastSemantic): number {
  return semantic === "error" || semantic === "warning" ? 2 : 1;
}

/** Haptic fired on appear when the toast doesn't specify one. */
export function hapticFor(semantic: ToastSemantic, loading: boolean): ToastHaptic {
  if (loading) return "none";
  switch (semantic) {
    case "error":
      return "error";
    case "success":
      return "success";
    case "warning":
      return "warning";
    default:
      return "none";
  }
}

/** Minimum logical-pixel inset to keep clear at each screen edge. */
export type ToastSafeArea = {
  readonly bottom?: number;
  readonly left?: number;
  readonly right?: number;
  readonly top?: number;
};

/**
 * App-wide defaults, applied via `toast.setDefaults`.
 *
 * `defaultPosition`, `defaultDuration`, `defaultGlass`, `maxLines` and
 * `titleMaxLines` are applied when an individual toast omits them. `safeArea`
 * reserves app-owned space in addition to the device geometry, while `maxVisible`,
 * `maxQueue` and `dropPolicy` govern the native stack.
 */
export type ToastConfig = {
  /**
   * Auto-dismiss duration (ms) applied when a call site omits `duration`.
   * Undefined (the default) means "use the per-semantic defaults"
   * (success/info/warning 3s, error 4s); a value overrides them all uniformly.
   */
  readonly defaultDuration?: number;
  readonly defaultGlass: ToastGlass;
  readonly defaultPosition: ToastPosition;
  readonly dropPolicy: ToastDropPolicy;
  /**
   * App-wide message line cap. Undefined keeps the semantic defaults (two lines
   * for errors/warnings, one otherwise). A per-toast `maxLines` always wins.
   */
  readonly maxLines?: number;
  /** Reserved upper bound on total tracked toasts. */
  readonly maxQueue: number;
  /**
   * Max toasts shown per position (a vertical list). When a new toast would
   * exceed this, the oldest **auto-dismiss** toast in that position is dismissed
   * to make room.
   *
   * Persistent and loading toasts (those with no auto-dismiss duration) are
   * exempt: they are caller- or promise-owned and are never force-dismissed by
   * overflow. A position may therefore exceed `maxVisible` while it is full of
   * such toasts; they leave only when you dismiss them (or the user does).
   */
  readonly maxVisible: number;
  /**
   * Minimum logical-pixel inset to keep clear at each screen edge.
   *
   * The real system safe area is always honored; native rendering takes the
   * larger of the device inset and this value independently for each edge. This
   * can reserve space occupied by an app header, floating control, or bottom
   * navigation without double-counting the status bar / home indicator.
   */
  readonly safeArea: ToastSafeArea;
  /**
   * App-wide title line cap. Undefined keeps the one-line default. A per-toast
   * `titleMaxLines` always wins.
   */
  readonly titleMaxLines?: number;
};

export const DEFAULT_CONFIG: ToastConfig = {
  defaultGlass: "adaptive",
  defaultPosition: "topCenter",
  dropPolicy: "dropOldest",
  maxQueue: 8,
  maxVisible: 5,
  safeArea: {},
};

/** Only the native-relevant knobs are sent over the bridge. */
export function configToWire(config: ToastConfig): Record<string, unknown> {
  return {
    defaultGlass: config.defaultGlass,
    dropPolicy: config.dropPolicy,
    maxQueue: config.maxQueue,
    maxVisible: config.maxVisible,
    safeArea: {
      bottom: config.safeArea.bottom ?? 0,
      left: config.safeArea.left ?? 0,
      right: config.safeArea.right ?? 0,
      top: config.safeArea.top ?? 0,
    },
  };
}
