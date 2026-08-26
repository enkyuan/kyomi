import { ToastViewport } from "./atoms/viewport";
import { durationFor, type ToastConfig } from "./lib/config";
import { engine, type ToastHandle } from "./lib/manager";
import type { Toast } from "./lib/model";
import type { ToastStyleOverride } from "./lib/style";
import type { ToastPosition, ToastSemantic } from "./lib/types";

export { argbColor, hexColor, type ToastColor, type ToastStyleOverride } from "./lib/style";
export type { Toast, ToastAction } from "./lib/model";
export type { ToastHandle } from "./lib/manager";
export type { ToastConfig, ToastSafeArea } from "./lib/config";
export { ToastViewport };
export type {
  ToastActionRole,
  ToastDismissReason,
  ToastEvent,
  ToastGlass,
  ToastHaptic,
  ToastPosition,
  ToastProgressStyle,
  ToastSemantic,
  ToastSymbolEffect,
} from "./lib/types";

/**
 * Options accepted by the show methods. `duration` is in milliseconds: omit it
 * for the app/semantic default, pass `null` (or `0`) to make the toast
 * persistent.
 */
export type ShowOptions = Omit<Toast, "message" | "semantic">;

/** Options for a loading spinner toast — no duration, action, or tap handling. */
export type LoadingOptions = Omit<
  Toast,
  | "action"
  | "duration"
  | "haptic"
  | "leadingImage"
  | "loading"
  | "message"
  | "onTap"
  | "semantic"
  | "tapToDismiss"
>;

/**
 * A promise phase spec: a plain message, a full toast, or a builder over the
 * settled value.
 */
export type PromiseSpec<T> = string | Toast | ((value: T) => string | Toast);

export type PromiseOptions<T> = {
  readonly error?: PromiseSpec<unknown>;
  readonly loading?: string | Toast;
  readonly position?: ToastPosition;
  readonly style?: ToastStyleOverride;
  readonly success?: PromiseSpec<T>;
  readonly useDynamicIslandOrigin?: boolean;
};

/**
 * The primary API — a Sonner-style, context-free toaster whose show methods
 * return a {@link ToastHandle} **synchronously**.
 *
 * ```ts
 * toast.success("Saved to favorites");
 * toast.show("Plain message");
 *
 * const user = await toast.promise(api.signIn(email, password), {
 *   error: "Sign-in failed",
 *   loading: "Signing in…",
 *   success: (u) => `Welcome back, ${u.firstName}!`,
 * });
 *
 * const t = toast.show("Uploading…", { duration: null, progress: 0 });
 * void t.update({ progress: 0.6 });
 * void t.dismiss();
 * ```
 */
export const toast = {
  /** Number of toasts currently tracked (visible + queued). */
  get activeCount(): number {
    return engine.activeCount;
  },

  /** Ids of toasts currently tracked. */
  get activeIds(): readonly string[] {
    return engine.activeIds;
  },

  /**
   * Optional global hook mapping a thrown error to a user-safe message, used by
   * {@link promise} when no per-call `error` spec is supplied.
   */
  get errorMessageResolver(): ((error: unknown) => string) | undefined {
    return engine.errorMessageResolver;
  },

  set errorMessageResolver(resolver: ((error: unknown) => string) | undefined) {
    engine.errorMessageResolver = resolver;
  },

  /** Resets all toast state. Test-only — lets each test start clean. */
  debugReset: (): Promise<void> => engine.debugReset(),

  /** Simulates an action-button tap on the live toast `id`. Test/demo-only. */
  debugTriggerAction: (id: string): Promise<void> => engine.debugTriggerAction(id),

  /** Dismisses toast `id`. Prefer `handle.dismiss()` when you hold a handle. */
  dismiss: (id: string): Promise<void> => engine.dismiss(id),

  /** Dismisses every toast. */
  dismissAll: (): Promise<void> => engine.dismissAll(),

  /** An error toast (lingers a beat longer by default). */
  error: (message: string, options?: ShowOptions): ToastHandle =>
    semanticShow("error", message, options),

  /** An info toast. */
  info: (message: string, options?: ShowOptions): ToastHandle =>
    semanticShow("info", message, options),

  /**
   * A persistent spinner toast. Morph it later with `handle.update`/
   * `handle.replace`, or remove it with `handle.dismiss`.
   */
  loading: (message: string, options?: LoadingOptions): ToastHandle =>
    engine.show({ ...options, loading: true, message, tapToDismiss: false }),

  /**
   * Ties `work` to a loading toast: a spinner while it runs, then a success or
   * error toast.
   *
   * **Returns the promise's value** (or rethrows its error) so the caller owns the
   * outcome — the visual is best-effort and never swallows the result.
   *
   * `loading` is a string or a {@link Toast}. `success` / `error` are a string, a
   * toast, or a builder over the settled value. Anything else throws immediately
   * (before `work` is awaited). When `error` is omitted the message comes from
   * {@link errorMessageResolver}, falling back to the error's string form.
   */
  promise: <T>(work: Promise<T>, options?: PromiseOptions<T>): Promise<T> => {
    const opts = options ?? {};
    const { position, style, useDynamicIslandOrigin } = opts;
    const phase = (semantic: ToastSemantic, message: string): Toast => ({
      duration: engine.currentConfig.defaultDuration ?? durationFor(semantic),
      message,
      position,
      semantic,
      style,
      useDynamicIslandOrigin,
    });

    // Specs are validated eagerly so misuse throws at the call site, not after
    // the promise settles.
    const loading = resolveLoadingSpec(opts.loading, {
      position,
      style,
      useDynamicIslandOrigin,
    });
    const success = resolveSpec<T>(
      opts.success,
      "success",
      (message) => phase("success", message),
      "Done",
    );
    const error = resolveSpec<unknown>(
      opts.error,
      "error",
      (message) => phase("error", message),
      // An omitted `error` spec derives the message from the thrown value, via
      // the app-wide resolver when one is installed.
      (thrown) => engine.errorMessageResolver?.(thrown) ?? stringifyError(thrown),
    );

    return engine.promiseWith(work, { error, loading, success });
  },

  /** Advisory device geometry / capability snapshot. */
  queryGeometry: (): Promise<Record<string, unknown>> => engine.queryGeometry(),

  /**
   * Full-control escape hatch. Explicit toast values win; omitted position and
   * line limits inherit the app defaults.
   */
  raw: (value: Toast): ToastHandle => engine.show(value),

  /**
   * Sets app-wide defaults (position, duration, stack/queue limits) and pushes
   * them to native.
   */
  setDefaults: (config: Partial<ToastConfig>): Promise<void> => engine.setDefaults(config),

  /**
   * Shows a toast and returns its handle immediately — no `await` needed.
   * Omitting `duration` uses the app/semantic default; an explicit `null` makes
   * the toast persistent.
   */
  show: (message: string, options?: ShowOptions): ToastHandle =>
    semanticShow("none", message, options),

  /** A success toast. */
  success: (message: string, options?: ShowOptions): ToastHandle =>
    semanticShow("success", message, options),

  /** A warning toast. */
  warning: (message: string, options?: ShowOptions): ToastHandle =>
    semanticShow("warning", message, options),
};

/**
 * The single place a convenience toast is constructed, including the
 * omitted-vs-explicit-null duration resolution: explicit >
 * `ToastConfig.defaultDuration` > per-semantic default.
 */
function semanticShow(
  semantic: ToastSemantic,
  message: string,
  options: ShowOptions | undefined,
): ToastHandle {
  const opts = options ?? {};
  // `undefined` means the caller omitted it; `null` is an explicit request for a
  // persistent toast and must survive untouched.
  const duration =
    opts.duration === undefined
      ? (engine.currentConfig.defaultDuration ?? durationFor(semantic))
      : opts.duration;
  return engine.show({ ...opts, duration, message, semantic });
}

function resolveLoadingSpec(
  spec: string | Toast | undefined,
  base: {
    readonly position?: ToastPosition;
    readonly style?: ToastStyleOverride;
    readonly useDynamicIslandOrigin?: boolean;
  },
): Toast {
  if (spec === undefined)
    return { ...base, loading: true, message: "Loading…", tapToDismiss: false };
  if (typeof spec === "string") {
    return { ...base, loading: true, message: spec, tapToDismiss: false };
  }
  if (isToast(spec)) return spec;
  throw new TypeError("toast.promise: `loading` must be a string or a Toast");
}

/**
 * Validates a success/error spec **eagerly** (so misuse throws at the call site,
 * not after the promise settles) and returns a resolver that applies it to the
 * settled value.
 *
 * `build` turns a plain message into the phase toast; `defaultMessage` supplies
 * the message when the spec was omitted entirely.
 */
function resolveSpec<T>(
  spec: PromiseSpec<T> | undefined,
  name: "error" | "success",
  build: (message: string) => Toast,
  defaultMessage: string | ((value: T) => string),
): (value: T) => Toast {
  if (spec === undefined) {
    return (value) =>
      build(typeof defaultMessage === "string" ? defaultMessage : defaultMessage(value));
  }
  if (typeof spec === "string") return () => build(spec);
  if (typeof spec === "function") {
    return (value) => {
      const produced = spec(value);
      return typeof produced === "string" ? build(produced) : produced;
    };
  }
  if (isToast(spec)) return () => spec;
  throw new TypeError(
    `toast.promise: \`${name}\` must be a string, a Toast, or a function returning either`,
  );
}

function isToast(value: unknown): value is Toast {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { message?: unknown }).message === "string"
  );
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
