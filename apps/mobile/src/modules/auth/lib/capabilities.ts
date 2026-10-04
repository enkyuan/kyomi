/** The API lists its enabled sign-in methods in this header on every auth response. */
export const AUTH_CAPABILITIES_HEADER = "x-kyomi-auth-capabilities";

export type AuthCapabilities = {
  google: boolean;
  emailOtp: boolean;
  emailOtpUsesDevelopmentLog: boolean;
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
