import type { EventSubscription } from "expo-modules-core";

import Native, { type NativeToastEvent } from "../../../../../modules/liquid-toasts";
import { configToWire, DEFAULT_CONFIG, type ToastConfig } from "./config";
import { nextActionId, nextToastId, sessionPrefix } from "./ids";
import {
  effectiveMaxLines,
  effectiveTitleMaxLines,
  toastToWire,
  type Toast,
  type ToastAction,
} from "./model";
import { kindFromWire, reasonFromWire, type ToastDismissReason, type ToastEvent } from "./types";

/**
 * A deferred promise. The engine hands out `promise` immediately (so `show` can
 * return a handle synchronously) and resolves it later from the event router.
 */
type Deferred<T> = {
  readonly promise: Promise<T>;
  resolve: (value: T) => void;
  settled: boolean;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  const d: Deferred<T> = {
    promise,
    resolve: (value) => {
      if (d.settled) return;
      d.settled = true;
      resolve(value);
    },
    settled: false,
  };
  return d;
}

/** One live toast's JS-side bookkeeping. */
type ToastRegistration = {
  action?: ToastAction;
  activeActionId?: string;
  readonly dismissal: Deferred<ToastDismissReason>;
  /**
   * Bumped on every replace/patch. An async action captures the generation before
   * awaiting `onPressed`; if it changed by completion, the newer content owns the
   * lifecycle and the stale completion leaves it alone.
   */
  generation: number;
  /**
   * The last *requested* state of the toast. Updated synchronously when a
   * replace/patch is enqueued (before the platform op runs) so rapid-fire patches
   * compose off each other instead of off stale state.
   */
  lastToast: Toast;
  onTap?: () => void;
  /**
   * Serializes this toast's platform operations (show → update → dismiss) so a
   * synchronous `show` can return a handle before its platform call lands:
   * anything enqueued later waits its turn. Ops never leave a rejection on the
   * chain — `enqueue` converts failures to their fallback value.
   */
  opChain: Promise<unknown>;
};

/**
 * A live controller for a shown toast, returned **synchronously** by every show
 * call.
 *
 * Lets callers `update` (patch), `replace`, or `dismiss` a (typically persistent)
 * toast and await its dismissal. The backing deferred is **always** resolved — by
 * the terminal native event, by `dismissAll` reconciliation, or fail-safe if the
 * event bridge is lost — so `await handle.onDismissed` never hangs.
 */
export type ToastHandle = {
  /**
   * Explicit dismissal. The only way to remove a persistent toast (besides a user
   * swipe / tap). No-op if already dismissed.
   */
  readonly dismiss: () => Promise<void>;
  readonly id: string;
  readonly isDismissed: () => boolean;
  readonly isShowing: () => boolean;
  /** Resolves when the toast leaves the screen, with the reason. */
  readonly onDismissed: Promise<ToastDismissReason>;
  /**
   * Replaces this toast's content wholesale (the way to clear optional fields).
   * Returns whether it was applied.
   */
  readonly replace: (toast: Toast) => Promise<boolean>;
  /**
   * Patch-style update: only the fields you pass change; everything else is kept
   * from the toast's last requested state. Native cross-fades / morphs the content
   * in place.
   *
   * Rapid-fire patches compose — `update({progress: .1})` then
   * `update({progress: .2})` both land, in order, even before the first reaches
   * native. To make a toast persistent pass `duration: 0`; to *clear* an optional
   * field use `replace`.
   *
   * Returns whether the update was applied (`false` if already dismissed or the
   * native toast was gone — an expected race, not an error).
   */
  readonly update: (patch: Partial<Toast>) => Promise<boolean>;
};

/**
 * The internal engine behind the global `toast` object. Owns the registry, the
 * event subscription, the handshake, and app-wide defaults.
 *
 * Not exported from the barrel — application code goes through `toast`.
 */
class ToastEngine {
  /**
   * Optional global hook mapping a thrown error to a user-safe message, used by
   * the promise flow when no per-call error spec is supplied. Keeps a raw error
   * string from leaking internals into a user-facing toast.
   */
  errorMessageResolver?: (error: unknown) => string;

  private config: ToastConfig = DEFAULT_CONFIG;
  private eventSub?: EventSubscription;
  /**
   * In-flight (or completed) handshake, memoized so it runs once per session.
   * Cleared on failure so the next show retries it.
   */
  private handshakePromise?: Promise<void>;
  private readonly registry = new Map<string, ToastRegistration>();

  /** Number of toasts currently tracked (visible + queued). */
  get activeCount(): number {
    return this.registry.size;
  }

  /** Ids of toasts currently tracked. */
  get activeIds(): readonly string[] {
    return [...this.registry.keys()];
  }

  get currentConfig(): ToastConfig {
    return this.config;
  }

  /** Sets app-wide defaults and pushes stack/queue configuration to native. */
  async setDefaults(config: Partial<ToastConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.ensureInit();
    await Native.configure(configToWire(this.config));
  }

  // ---------------------------------------------------------------------------
  // Show / update / dismiss
  // ---------------------------------------------------------------------------

  /**
   * Shows `toast` and returns its handle **synchronously**. The platform call runs
   * in the background on the toast's op chain; update/dismiss issued before it
   * lands queue behind it. A failed or rejected show resolves the handle with
   * `channelLost` — errors never surface to fire-and-forget callers.
   */
  show(toast: Toast): ToastHandle {
    const resolved = this.resolveDefaults(toast);
    const id = nextToastId();
    const actionId = resolved.action ? nextActionId() : undefined;
    const registration: ToastRegistration = {
      action: resolved.action,
      activeActionId: actionId,
      dismissal: deferred<ToastDismissReason>(),
      generation: 0,
      lastToast: resolved,
      onTap: resolved.onTap,
      opChain: Promise.resolve(),
    };
    this.registry.set(id, registration);

    void this.enqueue<void>(id, undefined, async () => {
      try {
        await this.ensureInit();
        const ack = await Native.show(toastToWire(resolved, id, actionId));
        if (!ack.accepted) this.complete(id, "channelLost");
      } catch (error) {
        logError(error);
        this.complete(id, "channelLost");
      }
    });

    return this.makeHandle(id, registration);
  }

  /**
   * Replaces toast `id`'s content wholesale (native morphs in place). Resolves to
   * whether the update was applied (`false` if the toast was already gone — an
   * expected race, not an error).
   */
  replace(id: string, toast: Toast): Promise<boolean> {
    const registration = this.registry.get(id);
    if (!registration) return Promise.resolve(false);
    const resolved = this.resolveDefaults(toast);
    const actionId = resolved.action ? nextActionId() : undefined;
    // Rewire synchronously — before the platform op runs — so later patches
    // compose off this state and stale async-action completions can tell.
    registration.lastToast = resolved;
    registration.action = resolved.action;
    registration.activeActionId = actionId;
    registration.onTap = resolved.onTap;
    registration.generation += 1;
    return this.enqueue<boolean>(id, false, async () => {
      const ack = await Native.update(toastToWire(resolved, id, actionId));
      return ack.applied;
    });
  }

  /**
   * Patch-style update: applies the given fields on top of the toast's last
   * requested state.
   */
  patch(id: string, patch: Partial<Toast>): Promise<boolean> {
    const registration = this.registry.get(id);
    if (!registration) return Promise.resolve(false);
    return this.replace(id, { ...registration.lastToast, ...patch });
  }

  /**
   * Dismisses toast `id`. If native had already dropped it, the handle is
   * resolved locally so `onDismissed` never hangs.
   */
  dismiss(id: string): Promise<void> {
    if (!this.registry.has(id)) return Promise.resolve();
    return this.enqueue<void>(id, undefined, async () => {
      const ack = await Native.dismiss(id);
      if (!ack.dismissed) this.complete(id, "manual");
    });
  }

  /**
   * Dismisses every toast. Resolves every tracked handle, and chases any show
   * still in flight (one that would land natively *after* the dismissAll) with an
   * idempotent per-id dismiss so no native toast is orphaned.
   */
  async dismissAll(): Promise<void> {
    const pending = new Map(this.registry);
    let dismissedIds: readonly string[] = [];
    try {
      const ack = await Native.dismissAll();
      dismissedIds = ack.dismissedIds;
    } catch (error) {
      logError(error);
    }
    for (const id of dismissedIds) this.complete(id, "dismissAll");
    for (const [id, registration] of pending) {
      if (!this.registry.has(id)) continue; // already reconciled
      this.complete(id, "dismissAll");
      // A queued-but-not-started show sees its dead registration and no-ops; an
      // already-in-flight one lands natively, then this dismiss clears it.
      void registration.opChain.then(() => Native.dismiss(id)).catch(logError);
    }
  }

  /**
   * Waits until every operation enqueued so far for toast `id` has landed. Used
   * by tests — prefer it over pumping arbitrary delays.
   */
  settle(id: string): Promise<unknown> {
    return this.registry.get(id)?.opChain ?? Promise.resolve();
  }

  /** Advisory device geometry / capability snapshot. */
  queryGeometry(): Promise<Record<string, unknown>> {
    return Native.queryGeometry();
  }

  // ---------------------------------------------------------------------------
  // Promise
  // ---------------------------------------------------------------------------

  /**
   * Ties `work` to a loading toast: shows `loading`, then morphs to the
   * success/error toast. **Returns the promise's value** (or rethrows its error)
   * so the caller owns the outcome — the visual is best-effort: if the toast was
   * dismissed mid-flight the morph is skipped, and a throwing builder is logged
   * and never corrupts the returned promise.
   */
  async promiseWith<T>(
    work: Promise<T>,
    specs: {
      readonly error: (error: unknown) => Toast;
      readonly loading: Toast;
      readonly success: (value: T) => Toast;
    },
  ): Promise<T> {
    const handle = this.show(specs.loading);
    try {
      const value = await work;
      await this.morphGuarded(handle, () => specs.success(value));
      return value;
    } catch (error) {
      await this.morphGuarded(handle, () => specs.error(error));
      throw error;
    }
  }

  private async morphGuarded(handle: ToastHandle, build: () => Toast): Promise<void> {
    if (!handle.isShowing()) return;
    let next: Toast;
    try {
      next = build();
    } catch (error) {
      logError(error);
      await handle.dismiss();
      return;
    }
    await handle.replace(next);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private makeHandle(id: string, registration: ToastRegistration): ToastHandle {
    const isShowing = () => !registration.dismissal.settled;
    return {
      dismiss: () => (isShowing() ? this.dismiss(id) : Promise.resolve()),
      id,
      isDismissed: () => registration.dismissal.settled,
      isShowing,
      onDismissed: registration.dismissal.promise,
      replace: (toast: Toast) => (isShowing() ? this.replace(id, toast) : Promise.resolve(false)),
      update: (patch: Partial<Toast>) =>
        isShowing() ? this.patch(id, patch) : Promise.resolve(false),
    };
  }

  /**
   * Chains `op` onto toast `id`'s op chain. Ops run strictly in FIFO order per
   * toast; different toasts never block each other. Failures resolve to `orElse`
   * (after logging) so an error can never escape to a fire-and-forget caller or
   * poison the chain.
   */
  private enqueue<T>(id: string, orElse: T, op: () => Promise<T>): Promise<T> {
    const registration = this.registry.get(id);
    if (!registration) return Promise.resolve(orElse);
    const run = registration.opChain.then(async () => {
      // The registration may have been resolved/removed while queued.
      if (this.registry.get(id) !== registration) return orElse;
      try {
        return await op();
      } catch (error) {
        logError(error);
        return orElse;
      }
    });
    registration.opChain = run;
    return run;
  }

  /** Applies app-wide defaults that need omitted-vs-explicit tracking. */
  private resolveDefaults(toast: Toast): Toast {
    return {
      ...toast,
      maxLines: toast.maxLines ?? this.config.maxLines ?? effectiveMaxLines(toast),
      position: toast.position ?? this.config.defaultPosition,
      titleMaxLines:
        toast.titleMaxLines ?? this.config.titleMaxLines ?? effectiveTitleMaxLines(toast),
    };
  }

  private async ensureInit(): Promise<void> {
    this.handshakePromise ??= this.doHandshake();
    await this.handshakePromise;
    // (Re-)subscribe here rather than once: a lost bridge nulls eventSub so the
    // next show can recover.
    this.eventSub ??= Native.addListener("onToastEvent", (payload) => {
      this.onEvent(fromNative(payload));
    });
  }

  private async doHandshake(): Promise<void> {
    try {
      await Native.handshake(sessionPrefix);
    } catch (error) {
      this.handshakePromise = undefined; // retry on the next show
      throw error;
    }
  }

  private onEvent(event: ToastEvent): void {
    const registration = this.registry.get(event.id);
    if (!registration) return; // stale / unknown id
    switch (event.kind) {
      case "action":
        // Drop a stale tap that arrived after an update swapped the action.
        if (event.actionId !== undefined && event.actionId !== registration.activeActionId) {
          return;
        }
        void this.runAction(event.id, registration);
        return;
      case "dismissed":
        this.complete(event.id, event.reason);
        return;
      case "tap":
        guarded(registration.onTap);
        return;
      default:
        return;
    }
  }

  /**
   * Runs an action's `onPressed` (sync or async), guarded. For a `loadingOnPress`
   * action native keeps the toast up (spinner) while the promise runs, so finish
   * the lifecycle on completion — unless an update superseded this action
   * mid-await (generation moved), in which case the newer content owns it.
   */
  private async runAction(id: string, registration: ToastRegistration): Promise<void> {
    const action = registration.action;
    if (!action) return;
    const generation = registration.generation;
    try {
      await action.onPressed();
    } catch (error) {
      logError(error);
    }
    // Sync actions: native already dismissed on tap (per dismissOnPress).
    if (action.loadingOnPress !== true) return;
    if (this.registry.get(id) !== registration || registration.generation !== generation) {
      return;
    }
    if (action.dismissOnPress ?? true) {
      await this.dismiss(id);
    } else {
      // Keep the toast up: clear the spinner and re-arm its auto-dismiss.
      await this.enqueue<void>(id, undefined, () => Native.finishAction(id));
    }
  }

  private complete(id: string, reason: ToastDismissReason): void {
    const registration = this.registry.get(id);
    if (!registration) return;
    this.registry.delete(id);
    registration.dismissal.resolve(reason);
  }

  // ---------------------------------------------------------------------------
  // Test hooks
  // ---------------------------------------------------------------------------

  /** Resets all engine state. Test-only — lets each test start clean. */
  async debugReset(): Promise<void> {
    this.eventSub?.remove();
    this.eventSub = undefined;
    this.registry.clear();
    this.handshakePromise = undefined;
    this.config = DEFAULT_CONFIG;
    this.errorMessageResolver = undefined;
    await Promise.resolve();
  }

  /** Emits a native event into the engine's router. Test-only. */
  debugEmit(event: ToastEvent): void {
    this.onEvent(event);
  }

  /** Simulates an action-button tap on the live toast `id`. Test/demo-only. */
  debugTriggerAction(id: string): Promise<void> {
    return Native.debugTriggerAction(id);
  }
}

/** Decodes a native payload into the JS-side event shape. */
function fromNative(payload: NativeToastEvent): ToastEvent {
  return {
    actionId: payload.actionId,
    id: payload.id,
    kind: kindFromWire(payload.event),
    reason: reasonFromWire(payload.reason),
    stackIndex: payload.stackIndex,
  };
}

function guarded(callback: (() => void) | undefined): void {
  if (!callback) return;
  try {
    callback();
  } catch (error) {
    logError(error);
  }
}

function logError(error: unknown): void {
  // `__DEV__` is a Metro-injected global; guard the lookup so this module also
  // runs under a plain JS runtime (tests, Node) where it is undefined.
  if (typeof __DEV__ === "undefined" || __DEV__) {
    console.warn("[liquid-toasts]", error);
  }
}

export const engine = new ToastEngine();
