import { Platform } from "react-native";

type OriginEnvironment = {
  /** `__DEV__`: a Metro development bundle rather than a release bundle. */
  readonly dev: boolean;
  readonly platform: string;
};

const HTTPS_ORIGIN = /^https:\/\/[^\s/?#]+/i;

/**
 * The API origin, which carries the session cookie and every sign-in code. A development bundle
 * accepts any configured origin and falls back to the local API. A release bundle must be given an
 * `https:` origin and has no fallback, so a missing or mistyped `EXPO_PUBLIC_AUTH_ORIGIN` stops the
 * app at startup instead of sending the session in clear text to a local server.
 */
export function parseAuthOrigin(
  configured: string | undefined,
  { dev, platform }: OriginEnvironment,
): string {
  const origin = configured?.trim();

  if (!dev && !origin) {
    throw new Error(
      "EXPO_PUBLIC_AUTH_ORIGIN must be set to the API's https origin in release builds.",
    );
  }
  if (!dev && origin && !HTTPS_ORIGIN.test(origin)) {
    throw new Error("EXPO_PUBLIC_AUTH_ORIGIN must be an https origin in release builds.");
  }
  if (origin) {
    return origin.replace(/\/$/, "");
  }

  return platform === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000";
}

export function resolveAuthOrigin(): string {
  // The variable is read by name so Metro inlines it into the bundle at build time.
  return parseAuthOrigin(process.env.EXPO_PUBLIC_AUTH_ORIGIN, {
    dev: __DEV__,
    platform: Platform.OS,
  });
}
