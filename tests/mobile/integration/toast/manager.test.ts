/**
 * Engine parity tests for the `liquid-toasts` port.
 *
 * These pin the behaviors that are easy to break in a rewrite and that the
 * native side cannot enforce: per-toast FIFO op ordering, stale action-tap
 * rejection, the generation guard on async actions, the promise value/throw
 * passthrough, and `dismissAll` reconciliation.
 *
 * The native module is replaced with a scriptable fake via `bun:test`'s module
 * mock, so nothing here touches a device.
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";

type Call = { readonly args: unknown; readonly method: string };

/** A scriptable stand-in for the native module. */
const native = {
  /** Ordered log of every bridge call — the op-ordering assertions read this. */
  calls: [] as Call[],
  /** When true, `show` rejects (simulates a lost bridge). */
  failShow: false,
  /** When true, `show` acks `accepted: false` (simulates no native overlay). */
  refuseShow: false,
  /** Ids native currently considers live. */
  live: new Set<string>(),
  listener: undefined as ((payload: Record<string, unknown>) => void) | undefined,
  /** When set, `show` waits on this before acking (simulates a slow native ack). */
  showGate: undefined as Promise<void> | undefined,

  addListener(_event: string, listener: (payload: Record<string, unknown>) => void) {
    native.listener = listener;
    return { remove: () => (native.listener = undefined) };
  },
  async configure(config: unknown) {
    native.calls.push({ args: config, method: "configure" });
  },
  async debugTriggerAction(id: string) {
    native.calls.push({ args: id, method: "debugTriggerAction" });
  },
  async dismiss(id: string) {
    native.calls.push({ args: id, method: "dismiss" });
    const dismissed = native.live.delete(id);
    return { dismissed, id };
  },
  async dismissAll() {
    native.calls.push({ args: undefined, method: "dismissAll" });
    const dismissedIds = [...native.live];
    native.live.clear();
    return { dismissedIds };
  },
  async finishAction(id: string) {
    native.calls.push({ args: id, method: "finishAction" });
  },
  async handshake(prefix: string) {
    native.calls.push({ args: prefix, method: "handshake" });
  },
  async queryGeometry() {
    return {};
  },
  async show(toast: Record<string, unknown>) {
    native.calls.push({ args: toast, method: "show" });
    if (native.failShow) throw new Error("bridge down");
    if (native.refuseShow) return { accepted: false, id: toast.id as string };
    if (native.showGate) await native.showGate;
    native.live.add(toast.id as string);
    return { accepted: true, id: toast.id as string };
  },
  async update(toast: Record<string, unknown>) {
    native.calls.push({ args: toast, method: "update" });
    return { applied: native.live.has(toast.id as string), id: toast.id as string };
  },
};

mock.module("../../../../apps/mobile/modules/liquid-toasts", () => ({ default: native }));
// The public barrel also exports the native viewport. These engine tests do not
// render it, so keep React Native's Flow entrypoint out of Bun's test runtime.
mock.module("../../../../apps/mobile/src/components/ui/toast/atoms/viewport", () => ({
  ToastViewport: () => null,
}));

const { toast } = await import("../../../../apps/mobile/src/components/ui/toast");
const { engine } = await import("../../../../apps/mobile/src/components/ui/toast/lib/manager");

/** Emits a native lifecycle event through the real subscription path. */
function emit(payload: Record<string, unknown>): void {
  native.listener?.(payload);
}

const methodsFor = (id: string) =>
  native.calls.filter((c) => c.method === "handshake" || argId(c) === id).map((c) => c.method);

function argId(call: Call): string | undefined {
  if (typeof call.args === "string") return call.args;
  if (typeof call.args === "object" && call.args !== null) {
    return (call.args as { id?: string }).id;
  }
  return undefined;
}

beforeEach(async () => {
  await toast.debugReset();
  native.calls = [];
  native.failShow = false;
  native.refuseShow = false;
  native.live = new Set();
  native.listener = undefined;
  native.showGate = undefined;
});

describe("op chain", () => {
  test("show returns a handle synchronously, before the native ack lands", () => {
    const handle = toast.success("Saved");
    expect(handle.id).toMatch(/^lt_/);
    expect(handle.isShowing()).toBe(true);
    // The bridge has not been touched yet — the op runs on the chain.
    expect(native.calls).toHaveLength(0);
  });

  test("update/dismiss issued before the show acks still land in FIFO order", async () => {
    let openGate!: () => void;
    native.showGate = new Promise<void>((resolve) => {
      openGate = resolve;
    });

    const handle = toast.show("Uploading…", { duration: null, progress: 0 });
    // Both are enqueued while `show` is still blocked on the gate.
    const updated = handle.update({ progress: 0.6 });
    const dismissed = handle.dismiss();

    openGate();
    await updated;
    await dismissed;
    await engine.settle(handle.id);

    expect(methodsFor(handle.id)).toEqual(["handshake", "show", "update", "dismiss"]);
  });

  test("rapid patches compose off each other, in order", async () => {
    const handle = toast.show("Uploading…", { duration: null, progress: 0 });
    void handle.update({ progress: 0.3 });
    void handle.update({ message: "Almost there" });
    await handle.update({ progress: 0.9 });
    await engine.settle(handle.id);

    const updates = native.calls.filter((c) => c.method === "update" && argId(c) === handle.id);
    expect(updates.map((c) => (c.args as { progress: number }).progress)).toEqual([0.3, 0.3, 0.9]);
    // The last patch composed off the previous message, not the original.
    expect((updates[2]?.args as { message: string }).message).toBe("Almost there");
  });

  test("a rejected show resolves the handle with channelLost instead of throwing", async () => {
    native.failShow = true;
    const handle = toast.success("Saved");
    await expect(handle.onDismissed).resolves.toBe("channelLost");
  });

  test("a refused show (no native overlay, e.g. web) still resolves the handle", async () => {
    // Mirrors the `unavailable` stub in modules/liquid-toasts: every ack reports
    // "already gone" rather than throwing, so handles must never hang.
    native.refuseShow = true;
    const handle = toast.success("Saved");
    await expect(handle.onDismissed).resolves.toBe("channelLost");
    expect(toast.activeCount).toBe(0);
  });
});

describe("action taps", () => {
  test("a stale tap is dropped after an update swapped the action", async () => {
    let pressed = 0;
    const handle = toast.show("Undo?", {
      action: { label: "Undo", onPressed: () => void pressed++ },
      duration: null,
    });
    await engine.settle(handle.id);
    const firstActionId = (
      native.calls.find((c) => c.method === "show")?.args as {
        action: { actionId: string };
      }
    ).action.actionId;

    await handle.update({ action: { label: "Redo", onPressed: () => void pressed++ } });

    // A tap carrying the superseded action id must not fire either callback.
    emit({ actionId: firstActionId, event: "actionTapped", id: handle.id });
    await Promise.resolve();
    expect(pressed).toBe(0);
  });

  test("a current tap fires onPressed", async () => {
    let pressed = 0;
    const handle = toast.show("Undo?", {
      action: { label: "Undo", onPressed: () => void pressed++ },
      duration: null,
    });
    await engine.settle(handle.id);
    const actionId = (
      native.calls.find((c) => c.method === "show")?.args as { action: { actionId: string } }
    ).action.actionId;

    emit({ actionId, event: "actionTapped", id: handle.id });
    await Promise.resolve();
    expect(pressed).toBe(1);
  });

  test("loadingOnPress + dismissOnPress:false clears the spinner via finishAction", async () => {
    const handle = toast.show("Retry?", {
      action: {
        dismissOnPress: false,
        label: "Retry",
        loadingOnPress: true,
        onPressed: async () => {
          await Promise.resolve();
        },
      },
      duration: null,
    });
    await engine.settle(handle.id);
    const actionId = (
      native.calls.find((c) => c.method === "show")?.args as { action: { actionId: string } }
    ).action.actionId;

    emit({ actionId, event: "actionTapped", id: handle.id });
    await engine.settle(handle.id);
    // Flush the async onPressed continuation, then its queued op.
    await new Promise((r) => setTimeout(r, 0));
    await engine.settle(handle.id);

    expect(methodsFor(handle.id)).toContain("finishAction");
  });

  test("an update mid-await supersedes the async action's lifecycle completion", async () => {
    let releasePress!: () => void;
    const pressGate = new Promise<void>((resolve) => {
      releasePress = resolve;
    });
    const handle = toast.show("Retry?", {
      action: {
        label: "Retry",
        loadingOnPress: true,
        onPressed: () => pressGate,
      },
      duration: null,
    });
    await engine.settle(handle.id);
    const actionId = (
      native.calls.find((c) => c.method === "show")?.args as { action: { actionId: string } }
    ).action.actionId;

    emit({ actionId, event: "actionTapped", id: handle.id });
    // A morph lands while `onPressed` is still pending — it bumps the generation.
    await handle.update({ message: "Reconnected", semantic: "success" });
    releasePress();
    await new Promise((r) => setTimeout(r, 0));
    await engine.settle(handle.id);

    // The stale completion must NOT dismiss the newer content.
    expect(methodsFor(handle.id)).not.toContain("dismiss");
    expect(handle.isShowing()).toBe(true);
  });
});

describe("promise contract", () => {
  test("returns the resolved value", async () => {
    const value = await toast.promise(Promise.resolve({ name: "Ada" }), {
      loading: "Signing in…",
      success: (u) => `Welcome ${u.name}`,
    });
    expect(value).toEqual({ name: "Ada" });
  });

  test("rethrows the original error", async () => {
    const boom = new Error("nope");
    await expect(
      toast.promise(Promise.reject(boom), { error: "Failed", loading: "Working…" }),
    ).rejects.toBe(boom);
  });

  test("a throwing success builder never corrupts the returned value", async () => {
    const value = await toast.promise(Promise.resolve(42), {
      loading: "Working…",
      success: () => {
        throw new Error("builder blew up");
      },
    });
    expect(value).toBe(42);
  });

  test("an invalid spec throws eagerly, before the work is awaited", () => {
    let awaited = false;
    const work = Promise.resolve(1).then((v) => {
      awaited = true;
      return v;
    });
    expect(() =>
      // @ts-expect-error deliberately invalid spec
      toast.promise(work, { loading: "Working…", success: 42 }),
    ).toThrow(TypeError);
    expect(awaited).toBe(false);
  });

  test("errorMessageResolver supplies the message when `error` is omitted", async () => {
    toast.errorMessageResolver = () => "Something went wrong";
    await expect(
      toast.promise(Promise.reject(new Error("raw internals")), { loading: "Working…" }),
    ).rejects.toBeInstanceOf(Error);
    await new Promise((r) => setTimeout(r, 0));

    const morph = native.calls.filter((c) => c.method === "update").at(-1);
    expect((morph?.args as { message: string }).message).toBe("Something went wrong");
    toast.errorMessageResolver = undefined;
  });
});

describe("dismissAll", () => {
  test("resolves every tracked handle", async () => {
    const a = toast.success("One");
    const b = toast.error("Two");
    await engine.settle(a.id);
    await engine.settle(b.id);

    await toast.dismissAll();

    await expect(a.onDismissed).resolves.toBe("dismissAll");
    await expect(b.onDismissed).resolves.toBe("dismissAll");
    expect(toast.activeCount).toBe(0);
  });

  test("chases an in-flight show so no native toast is orphaned", async () => {
    let openGate!: () => void;
    native.showGate = new Promise<void>((resolve) => {
      openGate = resolve;
    });

    const handle = toast.success("Late arrival");
    // dismissAll runs while the show is still in flight (native hasn't seen it).
    const all = toast.dismissAll();
    openGate();
    await all;
    await engine.settle(handle.id);
    await new Promise((r) => setTimeout(r, 0));

    // The chase dismiss must clear the toast that landed after dismissAll.
    expect(methodsFor(handle.id)).toContain("dismiss");
    expect(native.live.size).toBe(0);
  });
});

describe("lifecycle events", () => {
  test("a native dismissed event resolves the handle with its reason", async () => {
    const handle = toast.success("Saved");
    await engine.settle(handle.id);

    emit({ event: "dismissed", id: handle.id, reason: "swipe" });
    await expect(handle.onDismissed).resolves.toBe("swipe");
    expect(toast.activeCount).toBe(0);
  });

  test("an unknown wire reason degrades to `unknown` rather than throwing", async () => {
    const handle = toast.success("Saved");
    await engine.settle(handle.id);

    emit({ event: "dismissed", id: handle.id, reason: "not_a_real_reason" });
    await expect(handle.onDismissed).resolves.toBe("unknown");
  });

  test("a body tap invokes onTap", async () => {
    let tapped = 0;
    const handle = toast.show("Open", { onTap: () => void tapped++ });
    await engine.settle(handle.id);

    emit({ event: "tapped", id: handle.id });
    expect(tapped).toBe(1);
  });

  test("events for an unknown id are ignored", () => {
    expect(() => emit({ event: "dismissed", id: "lt_nope_0000", reason: "timeout" })).not.toThrow();
  });
});

describe("duration resolution", () => {
  test("omitted duration uses the per-semantic default (error lingers longer)", async () => {
    const err = toast.error("Broke");
    await engine.settle(err.id);
    const errWire = native.calls.find((c) => c.method === "show")?.args as {
      durationMs: number;
    };
    expect(errWire.durationMs).toBe(4000);

    native.calls = [];
    const ok = toast.success("Fine");
    await engine.settle(ok.id);
    const okWire = native.calls.find((c) => c.method === "show")?.args as {
      durationMs: number;
    };
    expect(okWire.durationMs).toBe(3000);
  });

  test("explicit null means persistent — no durationMs on the wire", async () => {
    const handle = toast.show("Stays put", { duration: null });
    await engine.settle(handle.id);
    const wire = native.calls.find((c) => c.method === "show")?.args as Record<string, unknown>;
    expect(wire.persistent).toBe(true);
    expect(wire.durationMs).toBeUndefined();
  });

  test("config defaultDuration overrides the semantic defaults uniformly", async () => {
    await toast.setDefaults({ defaultDuration: 7000 });
    const handle = toast.error("Broke");
    await engine.settle(handle.id);
    const wire = native.calls.find((c) => c.method === "show")?.args as { durationMs: number };
    expect(wire.durationMs).toBe(7000);
  });

  test("line limits resolve per-toast > app-wide > semantic fallback", async () => {
    // Semantic fallback: an error gets 2 message lines, a success 1.
    const err = toast.error("Broke");
    await engine.settle(err.id);
    expect((native.calls.at(-1)?.args as { maxLines: number }).maxLines).toBe(2);

    native.calls = [];
    const ok = toast.success("Fine");
    await engine.settle(ok.id);
    expect((native.calls.at(-1)?.args as { maxLines: number }).maxLines).toBe(1);

    // App-wide value replaces the semantic fallback...
    await toast.setDefaults({ maxLines: 4, titleMaxLines: 3 });
    native.calls = [];
    const configured = toast.success("Fine");
    await engine.settle(configured.id);
    const configuredWire = native.calls.at(-1)?.args as {
      maxLines: number;
      titleMaxLines: number;
    };
    expect(configuredWire.maxLines).toBe(4);
    expect(configuredWire.titleMaxLines).toBe(3);

    // ...but a per-toast value always wins over both.
    native.calls = [];
    const explicit = toast.success("Fine", { maxLines: 9, titleMaxLines: 8 });
    await engine.settle(explicit.id);
    const explicitWire = native.calls.at(-1)?.args as {
      maxLines: number;
      titleMaxLines: number;
    };
    expect(explicitWire.maxLines).toBe(9);
    expect(explicitWire.titleMaxLines).toBe(8);
  });

  test("a loading toast is persistent and carries the loading state", async () => {
    const handle = toast.loading("Connecting…");
    await engine.settle(handle.id);
    const wire = native.calls.find((c) => c.method === "show")?.args as Record<string, unknown>;
    expect(wire.state).toBe("loading");
    expect(wire.persistent).toBe(true);
    expect(wire.haptic).toBe("none");
  });
});
