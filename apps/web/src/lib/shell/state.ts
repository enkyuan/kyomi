import { SHELL_STATE_STORAGE_KEY } from "./storage-keys";

export type ShellStateSnapshot = {
  inboxFilter?: string;
  inboxLayout?: string;
  selectedItemId?: string | null;
};

export function writeShellStateSnapshot(snapshot: ShellStateSnapshot) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SHELL_STATE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage errors; this only improves the next first paint.
  }
}
