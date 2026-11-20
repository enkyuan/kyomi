import * as schema from "./schema";

const DEFAULT_LOCALHOST_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://[::1]:3000",
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
  /**
   * Also trust the development web origins on localhost. Off in production: any page served from
   * a user's own machine on port 3000 would otherwise be a trusted origin for credentialed calls.
   */
  includeLocalhost?: boolean;
}) {
  const configuredOrigins = options.trustedOrigins
    ?.split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (configuredOrigins && configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return Array.from(
    new Set([
      options.baseURL,
      ...(options.includeLocalhost === false ? [] : DEFAULT_LOCALHOST_ORIGINS),
      ...(options.additionalOrigins ?? []),
    ]),
  );
}

export function shouldUseSecureCookies(baseURL: string) {
  try {
    return new URL(baseURL).protocol === "https:";
  } catch {
    return false;
  }
}
