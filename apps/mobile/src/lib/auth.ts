import { expoClient, getCookie } from "@better-auth/expo/client";
import type { BetterAuthClientPlugin } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { NativeModules, Platform } from "react-native";

const AUTH_STORAGE_PREFIX = "better-auth";
const LOCAL_API_PORT = 8000;

/**
 * Dev builds load their JS from Metro, so the host that served this bundle is reachable from
 * the device by definition. Reusing it for the API keeps a physical phone working on any
 * network (LAN, hotspot, new DHCP lease) without baking an address into the build. Tunnel hosts
 * do not expose the API port, so they need an explicit EXPO_PUBLIC_AUTH_ORIGIN.
 */
function resolveMetroHostOrigin(): string | null {
  if (!__DEV__) return null;

  // The bundle URL is what React Native actually fetched, so prefer it over the manifest.
  const bundleUrl: unknown = NativeModules.SourceCode?.scriptURL;
  const source =
    (typeof bundleUrl === "string" ? bundleUrl : null) ?? Constants.expoConfig?.hostUri;
  const authority = source?.replace(/^[a-z]+:\/\//, "").split("/")[0];
  if (!authority) return null;

  const hostname = authority.startsWith("[")
    ? authority.slice(0, authority.indexOf("]") + 1)
    : authority.split(":")[0];
  if (!hostname || hostname.endsWith(".exp.direct")) return null;

  return `http://${hostname}:${LOCAL_API_PORT}`;
}

export function resolveAuthOrigin(): string {
  const configured = process.env.EXPO_PUBLIC_AUTH_ORIGIN?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }

  return (
    resolveMetroHostOrigin() ??
    (Platform.OS === "android"
      ? `http://10.0.2.2:${LOCAL_API_PORT}`
      : `http://localhost:${LOCAL_API_PORT}`)
  );
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
