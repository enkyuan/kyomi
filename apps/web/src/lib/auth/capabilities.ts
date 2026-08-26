export const AUTH_CAPABILITIES_HEADER = "x-kyomi-auth-capabilities";

export type AuthCapabilities = {
  google: boolean;
  emailOtp: boolean;
  emailOtpUsesDevelopmentLog: boolean;
};

export const DEFAULT_AUTH_CAPABILITIES: AuthCapabilities = {
  google: false,
  emailOtp: false,
  emailOtpUsesDevelopmentLog: false,
};

export function parseAuthCapabilities(value: string | null): AuthCapabilities {
  const enabled = new Set(
    value
      ?.split(",")
      .map((capability) => capability.trim())
      .filter(Boolean) ?? [],
  );

  return {
    google: enabled.has("google"),
    emailOtp: enabled.has("emailOtp"),
    emailOtpUsesDevelopmentLog: enabled.has("emailOtpUsesDevelopmentLog"),
  };
}
