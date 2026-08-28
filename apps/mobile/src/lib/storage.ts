export type AppStorage = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
};

export function createAppStorage(id: string): AppStorage {
  const keyFor = (key: string) => `kyomi:${id}:${key}`;

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
  };
}
