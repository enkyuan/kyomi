export const AUTH_CAPABILITIES_HEADER = "x-kyomi-auth-capabilities";

export type AuthCapabilities = {
  google: boolean;
  passwordReset: boolean;
  passwordResetUsesDevelopmentLog: boolean;
};

export const DEFAULT_AUTH_CAPABILITIES: AuthCapabilities = {
  google: false,
  passwordReset: false,
  passwordResetUsesDevelopmentLog: false,
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
    passwordReset: enabled.has("passwordReset"),
    passwordResetUsesDevelopmentLog: enabled.has("passwordResetUsesDevelopmentLog"),
  };
}
