import { Appearance, Platform } from "react-native";
import { createAppStorage } from "@lib/storage";

export type ThemeMode = "system" | "light" | "dark";

const THEME_MODE_KEY = "mode";
const appearanceStorage = createAppStorage("appearance");

export function readThemeMode(): ThemeMode {
  const stored = appearanceStorage.getString(THEME_MODE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

export function saveThemeMode(mode: ThemeMode) {
  appearanceStorage.set(THEME_MODE_KEY, mode);
}

export function applyThemeMode(mode: ThemeMode) {
  if (Platform.OS === "web") {
    if (typeof document !== "undefined") {
      document.documentElement.style.colorScheme = mode === "system" ? "" : mode;
    }
    return;
  }

  Appearance.setColorScheme(mode === "system" ? "unspecified" : mode);
}

/** Apply the saved mode once at startup, before the first screen renders. */
export function restoreThemeMode() {
  applyThemeMode(readThemeMode());
}
