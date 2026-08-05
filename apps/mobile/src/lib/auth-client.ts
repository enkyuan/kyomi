import { expoClient, getCookie } from "@better-auth/expo/client";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { resolveAuthOrigin } from "./auth-origin";

const AUTH_STORAGE_PREFIX = "better-auth";

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
