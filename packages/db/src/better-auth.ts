import * as schema from "./schema";

const DEFAULT_LOCALHOST_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://[::1]:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://[::1]:5173",
] as const;

export const betterAuthSchema = {
  ...schema,
  user: schema.users,
  session: schema.sessions,
  account: schema.accounts,
  verification: schema.verifications,
};

export function resolveBetterAuthBaseUrl(
  explicitBaseUrl: string | null | undefined,
  fallbackBaseUrl: string,
) {
  return (explicitBaseUrl ?? fallbackBaseUrl).replace(/\/$/, "");
}

export function resolveBetterAuthTrustedOrigins(options: {
  baseURL: string;
  trustedOrigins?: string | null | undefined;
  additionalOrigins?: readonly string[];
}) {
  const configuredOrigins = options.trustedOrigins
    ?.split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (configuredOrigins && configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return Array.from(
    new Set([options.baseURL, ...DEFAULT_LOCALHOST_ORIGINS, ...(options.additionalOrigins ?? [])]),
  );
}

export function shouldUseSecureCookies(baseURL: string) {
  try {
    return new URL(baseURL).protocol === "https:";
  } catch {
    return false;
  }
}
