import { z } from "zod";

const emailFormatSchema = z.email({ error: "Enter a valid email address" });

/** Lowercases a valid address; returns null when the input is not a valid email. */
export function normalizeEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!emailFormatSchema.safeParse(trimmed).success) {
    return null;
  }
  return trimmed.toLowerCase();
}
