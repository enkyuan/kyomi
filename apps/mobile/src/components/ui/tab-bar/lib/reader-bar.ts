import { useSyncExternalStore } from "react";
import type { TabBarReader } from "../../../../../modules/tab-bar";

/**
 * What the open reader hands the tab bar: its tools, and what to do when one is pressed or the text
 * size slider moves. A reader screen sets it while it is mounted and clears it on the way out, so
 * the bar shows the tools for exactly as long as an article is open.
 */
export type ReaderBar = {
  readonly reader: TabBarReader;
  readonly onTool: (key: string) => void;
  readonly onFontSize: (size: number, committed: boolean) => void;
};

let current: ReaderBar | null = null;
const listeners = new Set<() => void>();

export function setReaderBar(next: ReaderBar | null) {
  if (current === next) return;
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useReaderBar(): ReaderBar | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
