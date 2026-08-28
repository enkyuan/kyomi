import { createMMKV } from "react-native-mmkv";
import type { AppStorage } from "./storage";

export function createAppStorage(id: string): AppStorage {
  const storage = createMMKV({ id });

  return {
    getString: (key) => storage.getString(key),
    set: (key, value) => storage.set(key, value),
    remove: (key) => storage.remove(key),
  };
}
