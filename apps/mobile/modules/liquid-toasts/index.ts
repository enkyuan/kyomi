import { requireOptionalNativeModule } from "expo";
import type { EventSubscription } from "expo-modules-core";

/**
 * The raw native binding. Everything here mirrors the wire protocol 1:1 and is
 * intentionally low-level — application code should use the `toast` object from
 * `@ui/toast` instead, which owns the callbacks, op ordering, and handles.
 *
 * Command acks are maps, matching the native side exactly: `show` → `{accepted}`,
 * `update` → `{applied}`, `dismiss` → `{dismissed}`, `dismissAll` →
 * `{dismissedIds}`. A `false`/missing ack is an expected race (the toast is
 * already gone), not an error.
 */
export type ShowAck = {
  readonly accepted: boolean;
  readonly capability?: {
    readonly dynamicIslandOriginUsed: boolean;
    readonly glassMode: string;
  };
  readonly id: string;
};

export type UpdateAck = {
  readonly applied: boolean;
  readonly id: string;
  readonly reason?: string;
};

export type DismissAck = {
  readonly dismissed: boolean;
  readonly id: string;
  readonly reason?: string;
};

export type DismissAllAck = { readonly dismissedIds: readonly string[] };

/** The native → JS lifecycle event payload, routed by `id` on the JS side. */
export type NativeToastEvent = {
  readonly actionId?: string;
  readonly event: string;
  readonly id: string;
  readonly reason?: string;
  readonly stackIndex?: number;
  readonly tsMs?: number;
};

type LiquidToastsNativeModule = {
  addListener: (
    event: "onToastEvent",
    listener: (payload: NativeToastEvent) => void,
  ) => EventSubscription;
  configure: (config: Record<string, unknown>) => Promise<void>;
  debugTriggerAction: (id: string) => Promise<void>;
  dismiss: (id: string) => Promise<DismissAck>;
  dismissAll: (reason?: string) => Promise<DismissAllAck>;
  finishAction: (id: string) => Promise<void>;
  handshake: (sessionPrefix: string) => Promise<void>;
  queryGeometry: () => Promise<Record<string, unknown>>;
  show: (toast: Record<string, unknown>) => Promise<ShowAck>;
  update: (toast: Record<string, unknown>) => Promise<UpdateAck>;
};

/**
 * A no-op stand-in used where the native overlay does not exist (web). Every
 * command reports the "already gone" ack, which the engine treats as an expected
 * race — so `toast.*` calls stay safe to make from shared code and every handle
 * still resolves instead of hanging.
 *
 * ponytail: a real web renderer would be a separate DOM implementation; this only
 * keeps the web bundle importable. Build one if the web app needs visible toasts.
 */
const unavailable: LiquidToastsNativeModule = {
  addListener: () => ({ remove: () => {} }) as EventSubscription,
  configure: async () => {},
  debugTriggerAction: async () => {},
  dismiss: async (id) => ({ dismissed: false, id, reason: "unavailable" }),
  dismissAll: async () => ({ dismissedIds: [] }),
  finishAction: async () => {},
  handshake: async () => {},
  queryGeometry: async () => ({}),
  show: async (toast) => ({ accepted: false, id: String(toast.id) }),
  update: async (toast) => ({ applied: false, id: String(toast.id), reason: "unavailable" }),
};

export default requireOptionalNativeModule<LiquidToastsNativeModule>("LiquidToasts") ?? unavailable;
