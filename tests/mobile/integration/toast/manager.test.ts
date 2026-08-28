import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("../../../../apps/mobile/src/components/ui/toast/atoms/viewport", () => ({
  ToastViewport: () => null,
}));

const { toast } = await import("../../../../apps/mobile/src/components/ui/toast");
const { engine } = await import("../../../../apps/mobile/src/components/ui/toast/lib/manager");

beforeEach(async () => {
  await toast.debugReset();
});

function render(id: string) {
  return engine.getSnapshot().find((item) => item.id === id);
}

describe("JS toast engine", () => {
  test("show returns a synchronous handle and publishes a toast", () => {
    const handle = toast.success("Saved", { duration: null });
    expect(handle.id).toMatch(/^lt_/);
    expect(handle.isShowing()).toBe(true);
    expect(render(handle.id)?.toast.message).toBe("Saved");
  });

  test("rapid patches compose from the latest requested state", async () => {
    const handle = toast.show("Uploading…", { duration: null, progress: 0 });
    void handle.update({ progress: 0.3 });
    void handle.update({ message: "Almost there" });
    await handle.update({ progress: 0.9 });

    expect(render(handle.id)?.toast).toMatchObject({ message: "Almost there", progress: 0.9 });
  });

  test("group keys replace an existing toast in place", async () => {
    const first = toast.show("Working", { duration: null, groupKey: "sync" });
    const second = toast.show("Done", { duration: null, groupKey: "sync" });
    await second.update({ semantic: "success" });

    expect(second.id).toBe(first.id);
    expect(engine.activeCount).toBe(1);
    expect(render(first.id)?.toast.message).toBe("Done");
  });

  test("dropNewest resolves a toast that exceeds the queue", async () => {
    await toast.setDefaults({ dropPolicy: "dropNewest", maxQueue: 1 });
    const first = toast.show("One", { duration: null });
    const second = toast.show("Two", { duration: null });

    await expect(second.onDismissed).resolves.toBe("channelLost");
    expect(first.isShowing()).toBe(true);
  });
});

describe("actions", () => {
  test("a stale action id does not invoke the replaced callback", async () => {
    let pressed = 0;
    const handle = toast.show("Undo?", {
      action: { label: "Undo", onPressed: () => void pressed++ },
      duration: null,
    });
    const firstActionId = render(handle.id)?.actionId;
    await handle.update({ action: { label: "Redo", onPressed: () => void pressed++ } });

    engine.debugEmit({
      actionId: firstActionId,
      event: "actionTapped",
      id: handle.id,
      kind: "action",
      reason: "unknown",
    });
    await Promise.resolve();
    expect(pressed).toBe(0);
  });

  test("the current action invokes its callback and dismisses by default", async () => {
    let pressed = 0;
    const handle = toast.show("Undo?", {
      action: { label: "Undo", onPressed: () => void pressed++ },
      duration: null,
    });

    await engine.debugTriggerAction(handle.id);
    expect(pressed).toBe(1);
    await expect(handle.onDismissed).resolves.toBe("action");
  });

  test("loading actions clear their spinner when kept open", async () => {
    const handle = toast.show("Retry?", {
      action: {
        dismissOnPress: false,
        label: "Retry",
        loadingOnPress: true,
        onPressed: async () => Promise.resolve(),
      },
      duration: null,
    });

    await engine.debugTriggerAction(handle.id);
    expect(render(handle.id)?.actionLoading).toBe(false);
    expect(handle.isShowing()).toBe(true);
  });

  test("an update during an async action keeps the newer content alive", async () => {
    let releasePress!: () => void;
    const pressGate = new Promise<void>((resolve) => {
      releasePress = resolve;
    });
    const handle = toast.show("Retry?", {
      action: { label: "Retry", loadingOnPress: true, onPressed: () => pressGate },
      duration: null,
    });

    const action = engine.debugTriggerAction(handle.id);
    await handle.update({ message: "Reconnected", semantic: "success" });
    releasePress();
    await action;

    expect(handle.isShowing()).toBe(true);
    expect(render(handle.id)?.toast.message).toBe("Reconnected");
  });
});

describe("promise contract", () => {
  test("returns the resolved value", async () => {
    const value = await toast.promise(Promise.resolve({ name: "Ada" }), {
      loading: "Signing in…",
      success: (user) => `Welcome ${user.name}`,
    });
    expect(value).toEqual({ name: "Ada" });
  });

  test("rethrows the original error", async () => {
    const boom = new Error("nope");
    await expect(
      toast.promise(Promise.reject(boom), { error: "Failed", loading: "Working…" }),
    ).rejects.toBe(boom);
  });

  test("invalid specs throw before the work is awaited", () => {
    let awaited = false;
    const work = Promise.resolve(1).then((value) => {
      awaited = true;
      return value;
    });
    expect(() =>
      // @ts-expect-error deliberately invalid spec
      toast.promise(work, { loading: "Working…", success: 42 }),
    ).toThrow(TypeError);
    expect(awaited).toBe(false);
  });

  test("the error resolver supplies omitted error copy", async () => {
    toast.errorMessageResolver = () => "Something went wrong";
    await expect(
      toast.promise(Promise.reject(new Error("raw internals")), { loading: "Working…" }),
    ).rejects.toThrow();
    expect(engine.getSnapshot().at(-1)?.toast.message).toBe("Something went wrong");
  });
});

describe("lifecycle", () => {
  test("dismissAll resolves every tracked handle", async () => {
    const a = toast.success("One", { duration: null });
    const b = toast.error("Two", { duration: null });
    await toast.dismissAll();

    await expect(a.onDismissed).resolves.toBe("dismissAll");
    await expect(b.onDismissed).resolves.toBe("dismissAll");
    expect(toast.activeCount).toBe(0);
  });

  test("body taps invoke callbacks and dismiss with tap reason", async () => {
    let tapped = 0;
    const handle = toast.show("Open", { onTap: () => void tapped++, duration: null });
    engine.tap(handle.id);

    expect(tapped).toBe(1);
    await expect(handle.onDismissed).resolves.toBe("tap");
  });

  test("unknown lifecycle ids are ignored", () => {
    expect(() =>
      engine.debugEmit({ event: "dismissed", id: "lt_nope", kind: "dismissed", reason: "unknown" }),
    ).not.toThrow();
  });
});

describe("presentation defaults", () => {
  test("semantic durations and line caps resolve in JS", () => {
    const error = toast.error("Broke");
    expect(render(error.id)?.toast).toMatchObject({
      duration: 4000,
      maxLines: 2,
      titleMaxLines: 1,
    });

    const success = toast.success("Fine");
    expect(render(success.id)?.toast).toMatchObject({ duration: 3000, maxLines: 1 });
  });

  test("loading toasts stay persistent and suppress haptics", () => {
    const handle = toast.loading("Connecting…");
    expect(render(handle.id)?.toast).toMatchObject({ duration: 3000, loading: true });
    expect(
      engine.getSnapshot().find((item) => item.id === handle.id)?.toast.haptic,
    ).toBeUndefined();
  });
});
