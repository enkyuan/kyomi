import { describe, expect, test } from "bun:test";
import {
  resolveAuthCapabilities,
  resolveGoogleSocialProvider,
  serializeAuthCapabilities,
} from "@adapters/auth/capabilities";

describe("auth capabilities", () => {
  test("exposes only configured production capabilities", () => {
    expect(
      resolveAuthCapabilities({
        googleOAuthEnabled: true,
        nodeEnv: "production",
        resendApiKey: "re_test",
        emailFrom: "Kyomi <auth@example.com>",
      }),
    ).toEqual({
      google: true,
      passwordReset: true,
      passwordResetUsesDevelopmentLog: false,
    });

    expect(
      resolveAuthCapabilities({
        googleOAuthEnabled: false,
        nodeEnv: "production",
      }),
    ).toEqual({
      google: false,
      passwordReset: false,
      passwordResetUsesDevelopmentLog: false,
    });
  });

  test("keeps password reset available through development log links", () => {
    expect(
      resolveAuthCapabilities({
        googleOAuthEnabled: false,
        nodeEnv: "development",
      }),
    ).toMatchObject({ passwordReset: true, passwordResetUsesDevelopmentLog: true });
  });

  test("serializes enabled capabilities for the bootstrap response", () => {
    expect(
      serializeAuthCapabilities({
        google: true,
        passwordReset: false,
        passwordResetUsesDevelopmentLog: false,
      }),
    ).toBe("google");
  });
});

describe("Google provider configuration", () => {
  test("omits Google while its feature flag is disabled", () => {
    expect(
      resolveGoogleSocialProvider({
        enabled: false,
        clientId: "unused",
        clientSecret: "unused",
      }),
    ).toBeUndefined();
  });

  test("configures Google when the feature flag and credentials are present", () => {
    expect(
      resolveGoogleSocialProvider({
        enabled: true,
        clientId: "client-id",
        clientSecret: "client-secret",
      }),
    ).toEqual({ google: { clientId: "client-id", clientSecret: "client-secret" } });
  });

  test("rejects an enabled provider with incomplete credentials", () => {
    expect(() => resolveGoogleSocialProvider({ enabled: true })).toThrow(
      "Google OAuth credentials are required",
    );
  });
});
