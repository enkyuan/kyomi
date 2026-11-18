export type AppStorage = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
  /** Removes every key of this storage and leaves other storages alone. */
  clearAll(): void;
};

export function createAppStorage(id: string): AppStorage {
  const prefix = `kyomi:${id}:`;
  const keyFor = (key: string) => `${prefix}${key}`;

  return {
    getString: (key) => {
      if (typeof window === "undefined") return undefined;
      return window.localStorage.getItem(keyFor(key)) ?? undefined;
    },
    set: (key, value) => {
      if (typeof window !== "undefined") window.localStorage.setItem(keyFor(key), value);
    },
    remove: (key) => {
      if (typeof window !== "undefined") window.localStorage.removeItem(keyFor(key));
    },
    clearAll: () => {
      if (typeof window === "undefined") return;
      const { localStorage } = window;
      // Collect first: removing while iterating by index skips entries.
      const keys: string[] = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key?.startsWith(prefix)) keys.push(key);
      }
      for (const key of keys) localStorage.removeItem(key);
    },
  };
}
