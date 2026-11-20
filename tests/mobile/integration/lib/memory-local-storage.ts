/** An in-memory `localStorage`, the browser store `createAppStorage` falls back to outside native. */
export function createMemoryLocalStorage() {
  const raw = new Map<string, string>();

  return {
    clear: () => raw.clear(),
    getItem: (key: string) => raw.get(key) ?? null,
    key: (index: number) => [...raw.keys()][index] ?? null,
    get length() {
      return raw.size;
    },
    raw,
    removeItem: (key: string) => void raw.delete(key),
    setItem: (key: string, value: string) => void raw.set(key, value),
  };
}

/** Installs `localStorage` as `window.localStorage` and returns the function that removes it. */
export function installWindowStorage(localStorage: ReturnType<typeof createMemoryLocalStorage>) {
  const globals = globalThis as unknown as { window?: unknown };
  const previous = globals.window;
  globals.window = { localStorage };

  return () => {
    if (previous === undefined) delete globals.window;
    else globals.window = previous;
  };
}
