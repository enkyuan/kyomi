import { describe, expect, test } from "vitest";
import {
  emailOtpDefaultValues,
  emailOtpFormValidator,
  otpDefaultValues,
  otpFormValidator,
} from "@modules/auth/schema";

describe("emailOtpFormValidator", () => {
  test("validates valid email addresses", () => {
    expect(emailOtpFormValidator({ value: { email: "user@example.com" } })).toBeUndefined();
    expect(emailOtpFormValidator({ value: { email: "  user@example.com  " } })).toBeUndefined();
  });

  test("rejects empty or invalid email addresses", () => {
    expect(emailOtpFormValidator({ value: { email: "" } })).toEqual({
      fields: { email: "Enter a valid email address" },
    });
    expect(emailOtpFormValidator({ value: { email: "invalid-email" } })).toEqual({
      fields: { email: "Enter a valid email address" },
    });
  });

  test("provides empty default values", () => {
    expect(emailOtpDefaultValues).toEqual({ email: "" });
  });
});

describe("otpFormValidator", () => {
  test("validates 6-digit numeric OTP codes", () => {
    expect(otpFormValidator({ value: { otp: "123456" } })).toBeUndefined();
    expect(otpFormValidator({ value: { otp: "  654321  " } })).toBeUndefined();
  });

  test("rejects empty OTP code", () => {
    expect(otpFormValidator({ value: { otp: "" } })).toEqual({
      fields: { otp: "Code is required" },
    });
    expect(otpFormValidator({ value: { otp: "   " } })).toEqual({
      fields: { otp: "Code is required" },
    });
  });

  test("rejects non-6-digit or non-numeric codes", () => {
    expect(otpFormValidator({ value: { otp: "12345" } })).toEqual({
      fields: { otp: "Enter the 6-digit code sent to your email" },
    });
    expect(otpFormValidator({ value: { otp: "1234567" } })).toEqual({
      fields: { otp: "Enter the 6-digit code sent to your email" },
    });
    expect(otpFormValidator({ value: { otp: "12a456" } })).toEqual({
      fields: { otp: "Enter the 6-digit code sent to your email" },
    });
  });

  test("provides empty default values", () => {
    expect(otpDefaultValues).toEqual({ otp: "" });
  });
});
