import { env } from "@config/env";

export const AUTH_CAPABILITIES_HEADER = "x-kyomi-auth-capabilities";

export type AuthCapabilities = {
  google: boolean;
  emailOtp: boolean;
  emailOtpUsesDevelopmentLog: boolean;
};

export function resolveGoogleSocialProvider({
  enabled,
  clientId,
  clientSecret,
}: {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
}) {
  if (!enabled) {
    return undefined;
  }
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials are required when Google OAuth is enabled");
  }
  return { google: { clientId, clientSecret } };
}

export function resolveAuthCapabilities({
  googleOAuthEnabled,
  nodeEnv,
  resendApiKey,
  emailFrom,
}: {
  googleOAuthEnabled: boolean;
  nodeEnv: "development" | "production" | "test";
  resendApiKey?: string;
  emailFrom?: string;
}): AuthCapabilities {
  const hasEmailDelivery = Boolean(resendApiKey && emailFrom);
  return {
    google: googleOAuthEnabled,
    emailOtp: true,
    emailOtpUsesDevelopmentLog: nodeEnv !== "production" && !hasEmailDelivery,
  };
}

export function getAuthCapabilities(): AuthCapabilities {
  return resolveAuthCapabilities({
    googleOAuthEnabled: env.FEATURE_GOOGLE_OAUTH,
    nodeEnv: env.NODE_ENV,
    resendApiKey: env.RESEND_API_KEY,
    emailFrom: env.AUTH_EMAIL_FROM,
  });
}

export function serializeAuthCapabilities(capabilities: AuthCapabilities): string {
  return Object.entries(capabilities)
    .filter(([, enabled]) => enabled)
    .map(([capability]) => capability)
    .join(",");
}
