import { isValidEmail } from "@kyomi/reader/schemas/auth";

export * from "@kyomi/reader/schemas/auth";

export type EmailOTPFormValues = { email: string };
export type OtpFormValues = { otp: string };

export function emailOtpFormValidator({ value }: { value: EmailOTPFormValues }) {
  const normalized = value.email.trim();
  if (!isValidEmail(normalized)) {
    return { fields: { email: "Enter a valid email address" } };
  }
  return undefined;
}

export function otpFormValidator({ value }: { value: OtpFormValues }) {
  const otp = value.otp.trim();
  if (!otp) {
    return { fields: { otp: "Code is required" } };
  }
  if (!/^\d{6}$/.test(otp)) {
    return { fields: { otp: "Enter the 6-digit code sent to your email" } };
  }
  return undefined;
}

export const emailOtpDefaultValues: EmailOTPFormValues = { email: "" };
export const otpDefaultValues: OtpFormValues = { otp: "" };
