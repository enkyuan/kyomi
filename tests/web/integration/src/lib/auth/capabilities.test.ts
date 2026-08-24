import { describe, expect, test } from "vitest";
import { parseAuthCapabilities } from "@lib/auth/capabilities";

describe("parseAuthCapabilities", () => {
  test("parses the capability response header", () => {
    expect(parseAuthCapabilities("google,emailOtp,emailOtpUsesDevelopmentLog")).toEqual({
      google: true,
      emailOtp: true,
      emailOtpUsesDevelopmentLog: true,
    });
  });

  test("defaults missing and unknown capabilities to disabled", () => {
    expect(parseAuthCapabilities(null)).toEqual({
      google: false,
      emailOtp: false,
      emailOtpUsesDevelopmentLog: false,
    });
    expect(parseAuthCapabilities("unknown")).toEqual({
      google: false,
      emailOtp: false,
      emailOtpUsesDevelopmentLog: false,
    });
  });
});
