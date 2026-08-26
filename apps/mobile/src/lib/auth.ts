import { expoClient, getCookie } from "@better-auth/expo/client";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const AUTH_STORAGE_PREFIX = "better-auth";

export function resolveAuthOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_AUTH_ORIGIN?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";
}

export const authClient = createAuthClient({
  baseURL: resolveAuthOrigin(),
  plugins: [
    emailOTPClient(),
    expoClient({
      scheme: "kyomi",
      storage: SecureStore,
      storagePrefix: AUTH_STORAGE_PREFIX,
    }) as BetterAuthClientPlugin,
  ],
});

export function getAuthCookie(): string {
  return getCookie(SecureStore.getItem(`${AUTH_STORAGE_PREFIX}_cookie`) ?? "{}");
}
