import { Toast } from "@base-ui/react/toast";
import { getAnchorRect, type AnchoredToastData } from "./utils";

type ToastManager = ReturnType<typeof Toast.createToastManager>;
type ToastInput = Parameters<ToastManager["add"]>[0];
type ToastId = Parameters<ToastManager["update"]>[0];

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

function createAnchoredToastManager(): ToastManager {
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
      return existingToastId as ReturnType<ToastManager["add"]>;
    }

    const toastId = add(nextToast) as ToastId;
    groupedToastIds.set(groupKey, toastId);
    scheduleGroupCleanup(groupKey, toastId, nextToast);
    return toastId as ReturnType<ToastManager["add"]>;
  }) as ToastManager["add"];
  return manager;
}

export const anchoredToastManager: ToastManager = createAnchoredToastManager();
