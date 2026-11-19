import { Toast } from "@base-ui/react/toast";
import { getAnchorRect, type AnchoredToastData } from "./utils";

type BaseToastManager = ReturnType<typeof Toast.createToastManager>;
type BaseToastInput = Parameters<BaseToastManager["add"]>[0];
type ToastInput = BaseToastInput;
type ToastId = Parameters<BaseToastManager["update"]>[0];

/**
 * A toast is one line: a title, never a description. Base UI would accept a description, so the
 * managers are typed to refuse it and the renderers never draw one.
 */
export type ToastLine = Omit<BaseToastInput, "description" | "title"> & {
  description?: never;
  title: string;
};

type ToastPromiseLine = string | ToastLine;

export type ToastPromiseOptions<Value> = {
  loading: ToastPromiseLine;
  success: ToastPromiseLine | ((result: Value) => ToastPromiseLine);
  error: ToastPromiseLine | ((error: unknown) => ToastPromiseLine);
};

/** Base UI's manager with its `add`, `update` and `promise` narrowed to one-line toasts. */
export type ToastManager = Omit<BaseToastManager, "add" | "update" | "promise"> & {
  add(options: ToastLine): string;
  update(id: string, options: Partial<Omit<ToastLine, "id">>): void;
  promise<Value>(promise: Promise<Value>, options: ToastPromiseOptions<Value>): Promise<Value>;
};

function snapshotAnchoredToastInput(toast: ToastInput): ToastInput {
  const anchorRect = getAnchorRect(toast.positionerProps?.anchor);
  if (!anchorRect) {
    return toast;
  }

  return {
    ...toast,
    data: {
      ...toast.data,
      anchorRect,
    },
  };
}

function getAnchoredToastGroupKey(toast: ToastInput): string | null {
  const groupKey = (toast.data as AnchoredToastData | undefined)?.groupKey;
  return typeof groupKey === "string" && groupKey.length > 0 ? groupKey : null;
}

function getAnchoredToastCleanupDelay(toast: ToastInput): number | null {
  return typeof toast.timeout === "number" && Number.isFinite(toast.timeout) && toast.timeout > 0
    ? toast.timeout
    : null;
}

function createAnchoredToastManager(): BaseToastManager {
  const manager = Toast.createToastManager();
  const add = manager.add.bind(manager);
  const update = manager.update.bind(manager);
  const groupedToastIds = new Map<string, ToastId>();
  const cleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function scheduleGroupCleanup(groupKey: string, toastId: ToastId, toast: ToastInput): void {
    const existingTimer = cleanupTimers.get(groupKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const delay = getAnchoredToastCleanupDelay(toast);
    if (delay === null) {
      cleanupTimers.delete(groupKey);
      return;
    }

    const timer = setTimeout(() => {
      if (groupedToastIds.get(groupKey) === toastId) {
        groupedToastIds.delete(groupKey);
      }
      cleanupTimers.delete(groupKey);
    }, delay);
    cleanupTimers.set(groupKey, timer);
  }

  manager.add = ((toast: ToastInput) => {
    const nextToast = snapshotAnchoredToastInput(toast);
    const groupKey = getAnchoredToastGroupKey(nextToast);
    if (!groupKey) {
      return add(nextToast);
    }

    const existingToastId = groupedToastIds.get(groupKey);
    if (existingToastId) {
      update(existingToastId, nextToast);
      scheduleGroupCleanup(groupKey, existingToastId, nextToast);
      return existingToastId as ReturnType<BaseToastManager["add"]>;
    }

    const toastId = add(nextToast) as ToastId;
    groupedToastIds.set(groupKey, toastId);
    scheduleGroupCleanup(groupKey, toastId, nextToast);
    return toastId as ReturnType<BaseToastManager["add"]>;
  }) as BaseToastManager["add"];
  return manager;
}

export const anchoredToastManager: ToastManager = createAnchoredToastManager();
