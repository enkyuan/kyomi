import { Platform } from "react-native";

export function resolveAuthOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_AUTH_ORIGIN?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";
}
