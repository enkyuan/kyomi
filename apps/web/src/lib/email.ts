import { z } from "zod";

const emailFormatSchema = z.email({ error: "Enter a valid email address" });

/** Trimmed, non-empty email for auth and account forms. */
export const authEmailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .pipe(emailFormatSchema);

export function isValidEmail(value: string): boolean {
  return authEmailSchema.safeParse(value).success;
}

/** Lowercases a valid address; returns null when the input is not a valid email. */
export function normalizeEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!emailFormatSchema.safeParse(trimmed).success) {
    return null;
  }
  return trimmed.toLowerCase();
}
