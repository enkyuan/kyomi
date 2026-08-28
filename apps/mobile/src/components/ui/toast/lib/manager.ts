import { hapticFor, maxLinesFor, durationFor, DEFAULT_CONFIG, type ToastConfig } from "./config";
import { nextActionId, nextToastId } from "./ids";
import { effectiveMaxLines, effectiveTitleMaxLines, type Toast, type ToastAction } from "./model";
import type { ToastDismissReason, ToastEvent } from "./types";

export type ToastHandle = {
  readonly dismiss: () => Promise<void>;
  readonly id: string;
  readonly isDismissed: () => boolean;
  readonly isShowing: () => boolean;
  readonly onDismissed: Promise<ToastDismissReason>;
  readonly replace: (toast: Toast) => Promise<boolean>;
  readonly update: (patch: Partial<Toast>) => Promise<boolean>;
};

export type RenderToast = {
  readonly actionId?: string;
  readonly actionLoading: boolean;
  readonly id: string;
  readonly toast: Toast;
};

type Deferred<T> = {
  readonly promise: Promise<T>;
  resolve: (value: T) => void;
  settled: boolean;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const result: Deferred<T> = {
    promise: new Promise<T>((next) => {
      resolve = next;
    }),
    resolve: (value) => {
      if (result.settled) return;
      result.settled = true;
      resolve(value);
    },
    settled: false,
  };
  return result;
}

type Registration = {
  action?: ToastAction;
  actionId?: string;
  actionLoading: boolean;
  readonly dismissal: Deferred<ToastDismissReason>;
  generation: number;
  lastToast: Toast;
  onTap?: () => void;
  timer?: ReturnType<typeof setTimeout>;
};

/** JS toast engine. React owns rendering; this class owns context-free lifecycle state. */
class ToastEngine {
  errorMessageResolver?: (error: unknown) => string;

  private config: ToastConfig = DEFAULT_CONFIG;
  private readonly listeners = new Set<() => void>();
  private readonly registry = new Map<string, Registration>();
  private snapshotValue: readonly RenderToast[] = [];

  get activeCount(): number {
    return this.registry.size;
  }

  get activeIds(): readonly string[] {
    return [...this.registry.keys()];
  }

  get currentConfig(): ToastConfig {
    return this.config;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): readonly RenderToast[] => this.snapshotValue;

  async setDefaults(config: Partial<ToastConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    this.notify();
  }

  show(toast: Toast): ToastHandle {
    const resolved = this.resolveDefaults(toast);
    const existing = resolved.groupKey
      ? [...this.registry.entries()].find(
          ([, value]) => value.lastToast.groupKey === resolved.groupKey,
        )
      : undefined;
    if (existing) {
      const [id] = existing;
      void this.replace(id, resolved);
      return this.makeHandle(id, existing[1]);
    }

    const registration: Registration = {
      action: resolved.action,
      actionId: resolved.action ? nextActionId() : undefined,
      actionLoading: false,
      dismissal: deferred<ToastDismissReason>(),
      generation: 0,
      lastToast: resolved,
      onTap: resolved.onTap,
    };
    const id = nextToastId();

    if (this.registry.size >= this.config.maxQueue) {
      if (this.config.dropPolicy === "dropNewest") {
        registration.dismissal.resolve("channelLost");
        return this.makeHandle(id, registration);
      }
      const oldest = this.registry.keys().next().value as string | undefined;
      if (oldest) this.complete(oldest, "manual");
    }

    const samePosition = [...this.registry.entries()].filter(
      ([, value]) => value.lastToast.position === resolved.position,
    );
    if (samePosition.length >= this.config.maxVisible) {
      const overflow = samePosition.find(([, value]) => !this.isPersistent(value.lastToast));
      if (overflow) this.complete(overflow[0], "manual");
    }

    this.registry.set(id, registration);
    this.schedule(id, registration);
    this.notify();
    return this.makeHandle(id, registration);
  }

  replace(id: string, toast: Toast): Promise<boolean> {
    const registration = this.registry.get(id);
    if (!registration) return Promise.resolve(false);
    const resolved = this.resolveDefaults(toast);
    if (registration.timer) clearTimeout(registration.timer);
    registration.lastToast = resolved;
    registration.action = resolved.action;
    registration.actionId = resolved.action ? nextActionId() : undefined;
    registration.actionLoading = false;
    registration.onTap = resolved.onTap;
    registration.generation += 1;
    this.schedule(id, registration);
    this.notify();
    return Promise.resolve(true);
  }

  patch(id: string, patch: Partial<Toast>): Promise<boolean> {
    const registration = this.registry.get(id);
    if (!registration) return Promise.resolve(false);
    return this.replace(id, { ...registration.lastToast, ...patch });
  }

  dismiss(id: string, reason: ToastDismissReason = "manual"): Promise<void> {
    if (this.registry.has(id)) this.complete(id, reason);
    return Promise.resolve();
  }

  async dismissAll(): Promise<void> {
    for (const id of [...this.registry.keys()]) this.complete(id, "dismissAll");
  }

  settle(_id: string): Promise<void> {
    return Promise.resolve();
  }

  queryGeometry(): Promise<Record<string, unknown>> {
    return Promise.resolve({});
  }

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
    try {
      await handle.replace(build());
    } catch (error) {
      logError(error);
      await handle.dismiss();
    }
  }

  debugReset(): Promise<void> {
    for (const registration of this.registry.values()) {
      if (registration.timer) clearTimeout(registration.timer);
    }
    this.registry.clear();
    this.config = DEFAULT_CONFIG;
    this.errorMessageResolver = undefined;
    this.notify();
    return Promise.resolve();
  }

  debugEmit(event: ToastEvent): void {
    const registration = this.registry.get(event.id);
    if (!registration) return;
    if (event.kind === "dismissed") this.complete(event.id, event.reason);
    if (event.kind === "tap") this.invoke(registration.onTap);
    if (event.kind === "action") void this.triggerAction(event.id, event.actionId);
  }

  debugTriggerAction(id: string): Promise<void> {
    return this.triggerAction(id);
  }

  tap(id: string): void {
    const registration = this.registry.get(id);
    if (!registration) return;
    this.invoke(registration.onTap);
    if (registration.lastToast.tapToDismiss ?? true) this.complete(id, "tap");
  }

  triggerAction(id: string, actionId?: string): Promise<void> {
    return this.runAction(id, actionId);
  }

  private makeHandle(id: string, registration: Registration): ToastHandle {
    const isShowing = () => !registration.dismissal.settled;
    return {
      dismiss: () => (isShowing() ? this.dismiss(id) : Promise.resolve()),
      id,
      isDismissed: () => registration.dismissal.settled,
      isShowing,
      onDismissed: registration.dismissal.promise,
      replace: (toast) => (isShowing() ? this.replace(id, toast) : Promise.resolve(false)),
      update: (patch) => (isShowing() ? this.patch(id, patch) : Promise.resolve(false)),
    };
  }

  private resolveDefaults(toast: Toast): Toast {
    const semantic = toast.semantic ?? "none";
    const duration =
      toast.duration === undefined
        ? (this.config.defaultDuration ?? durationFor(semantic))
        : toast.duration;
    return {
      ...toast,
      duration,
      maxLines: toast.maxLines ?? this.config.maxLines ?? effectiveMaxLines(toast),
      position: toast.position ?? this.config.defaultPosition,
      titleMaxLines:
        toast.titleMaxLines ?? this.config.titleMaxLines ?? effectiveTitleMaxLines(toast),
    };
  }

  private schedule(id: string, registration: Registration): void {
    if (this.isPersistent(registration.lastToast)) return;
    const duration = registration.lastToast.duration;
    if (duration && duration > 0) {
      registration.timer = setTimeout(() => this.complete(id, "timeout"), duration);
    }
  }

  private isPersistent(toast: Toast): boolean {
    return toast.loading === true || toast.duration === null || toast.duration === 0;
  }

  private complete(id: string, reason: ToastDismissReason): void {
    const registration = this.registry.get(id);
    if (!registration) return;
    if (registration.timer) clearTimeout(registration.timer);
    this.registry.delete(id);
    registration.dismissal.resolve(reason);
    this.notify();
  }

  private notify(): void {
    this.snapshotValue = [...this.registry.entries()].map(([id, registration]) => ({
      actionId: registration.actionId,
      actionLoading: registration.actionLoading,
      id,
      toast: registration.lastToast,
    }));
    for (const listener of this.listeners) listener();
  }

  private async runAction(id: string, actionId?: string): Promise<void> {
    const registration = this.registry.get(id);
    if (!registration?.action) return;
    if (actionId !== undefined && actionId !== registration.actionId) return;
    const action = registration.action;
    const generation = registration.generation;
    if (action.loadingOnPress) {
      registration.actionLoading = true;
      this.notify();
    }
    try {
      await action.onPressed();
    } catch (error) {
      logError(error);
    }
    if (this.registry.get(id) !== registration || registration.generation !== generation) return;
    if (action.dismissOnPress ?? true) {
      this.complete(id, "action");
      return;
    }
    registration.actionLoading = false;
    this.schedule(id, registration);
    this.notify();
  }

  private invoke(callback: (() => void) | undefined): void {
    if (!callback) return;
    try {
      callback();
    } catch (error) {
      logError(error);
    }
  }
}

function logError(error: unknown): void {
  if (typeof __DEV__ === "undefined" || __DEV__) console.warn("[liquid-toast]", error);
}

export const engine = new ToastEngine();

export function hapticForToast(toast: Toast): string {
  return toast.haptic ?? hapticFor(toast.semantic ?? "none", toast.loading === true);
}
