// Value: protects=clearing one app storage removes all of its keys and none of another's, so sign-out can wipe account data without touching device settings;
//   fails_when=clearAll skips keys (removal while iterating), leaks into a storage whose id shares a prefix, or throws without a window;
//   why_new=AppStorage had no way to empty itself, so account data could only be removed key by key from the code that knew the keys;
//   seam=the browser implementation over an in-memory localStorage;
//   no_claim=green does not prove MMKV's clearAll (the native implementation is one delegating line).
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { createAppStorage } from "../../../../apps/mobile/src/lib/storage";
import { createMemoryLocalStorage, installWindowStorage } from "./memory-local-storage";

const localStorage = createMemoryLocalStorage();
let restoreWindow: () => void;

beforeAll(() => {
  restoreWindow = installWindowStorage(localStorage);
});

afterAll(() => restoreWindow());

beforeEach(() => localStorage.clear());

describe("AppStorage.clearAll", () => {
  test("removes every key of the storage, however many", () => {
    const storage = createAppStorage("recent-articles");
    for (let index = 0; index < 25; index += 1) storage.set(`key-${index}`, "value");

    storage.clearAll();

    expect(localStorage.length).toBe(0);
    expect(storage.getString("key-0")).toBeUndefined();
  });

  test("leaves other storages alone, including one whose id starts with the same words", () => {
    const reader = createAppStorage("reader");
    const position = createAppStorage("reader-position");
    const appearance = createAppStorage("appearance");
    reader.set("a", "1");
    position.set("a", "2");
    appearance.set("mode", "dark");
    localStorage.setItem("unrelated", "kept");

    reader.clearAll();

    expect(reader.getString("a")).toBeUndefined();
    expect(position.getString("a")).toBe("2");
    expect(appearance.getString("mode")).toBe("dark");
    expect(localStorage.getItem("unrelated")).toBe("kept");
  });

  test("does nothing without a browser window, as when the app renders on a server", () => {
    restoreWindow();
    try {
      expect(() => createAppStorage("recent-articles").clearAll()).not.toThrow();
    } finally {
      restoreWindow = installWindowStorage(localStorage);
    }
  });
});
