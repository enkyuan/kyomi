import { describe, expect, test } from "vitest";
import { parseAuthCapabilities } from "@lib/auth/capabilities";

describe("parseAuthCapabilities", () => {
  test("parses the capability response header", () => {
    expect(parseAuthCapabilities("google,passwordReset,passwordResetUsesDevelopmentLog")).toEqual({
      google: true,
      passwordReset: true,
      passwordResetUsesDevelopmentLog: true,
    });
  });

  test("defaults missing and unknown capabilities to disabled", () => {
    expect(parseAuthCapabilities(null)).toEqual({
      google: false,
      passwordReset: false,
      passwordResetUsesDevelopmentLog: false,
    });
    expect(parseAuthCapabilities("unknown")).toEqual({
      google: false,
      passwordReset: false,
      passwordResetUsesDevelopmentLog: false,
    });
  });
});
