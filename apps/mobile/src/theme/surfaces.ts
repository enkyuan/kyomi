import type { ColorSchemeName } from "react-native";

const FALLBACK_COLOR_SCHEME = "light";

/**
 * Native-safe sRGB equivalents of the shared web surface roles.
 *
 * Keep platform-native sheet materials native; these values are for Kyomi-owned
 * canvases, cards, and input fills only.
 */
export const mobileSurfaceThemes = {
  light: {
    background: "#f7f5f2",
    foreground: "#343434",
    card: "#f9f7f5",
    input: "rgba(0, 0, 0, 0.1)",
    mutedForeground: "#7f7f7f",
    secondary: "#edebe8",
    secondaryForeground: "#343434",
  },
  dark: {
    background: "#161616",
    foreground: "#f5f5f5",
    card: "#1b1b1b",
    input: "rgba(255, 255, 255, 0.08)",
    mutedForeground: "#818181",
    secondary: "#1f1f1f",
    secondaryForeground: "#f5f5f5",
  },
} as const;

export type MobileSurfaceTheme = (typeof mobileSurfaceThemes)[keyof typeof mobileSurfaceThemes];

export function getMobileSurfaceTheme(colorScheme: ColorSchemeName): MobileSurfaceTheme {
  return mobileSurfaceThemes[colorScheme === "dark" ? "dark" : FALLBACK_COLOR_SCHEME];
}
