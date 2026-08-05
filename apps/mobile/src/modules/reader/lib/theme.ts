import type { ColorSchemeName } from "react-native";

export const readerCanvas = {
  dark: "#202020",
  light: "#f8f7f5",
} as const;

export function getReaderColorScheme(colorScheme: ColorSchemeName): "dark" | "light" {
  return colorScheme === "dark" ? "dark" : "light";
}

export function getReaderCanvasColor(colorScheme: ColorSchemeName) {
  return readerCanvas[getReaderColorScheme(colorScheme)];
}
