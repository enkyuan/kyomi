import { describe, expect, test } from "bun:test";
import { parseAuthCapabilities } from "../../../../../../apps/mobile/src/modules/auth/lib/capabilities";

describe("auth capabilities", () => {
  test("enables only the sign-in methods the API advertises", () => {
    expect(parseAuthCapabilities("emailOtp, google")).toEqual({
      google: true,
      emailOtp: true,
      emailOtpUsesDevelopmentLog: false,
    });
  });

  test("treats a missing header as no optional sign-in methods", () => {
    expect(parseAuthCapabilities(null).google).toBe(false);
    expect(parseAuthCapabilities("").google).toBe(false);
  });
});
