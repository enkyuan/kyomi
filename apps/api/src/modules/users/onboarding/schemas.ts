import { CANONICAL_CATEGORY_LABELS } from "@kyomi/db";
import { z } from "zod";
import { Unprocessable } from "@shared/effect/errors";
import { bundles } from "./options";

export const handle = z
  .string()
  .trim()
  .regex(/^@?[a-zA-Z0-9_]{3,30}$/, "Use 3–30 letters, digits or underscores.")
  .transform((value) => value.replace(/^@/, "").toLowerCase());

function selection<T extends string>(choices: readonly T[]) {
  return z
    .array(z.enum(choices))
    .min(1)
    .max(choices.length)
    .refine((values) => new Set(values).size === values.length, "Select each option once.");
}

export const form = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[^\p{Cc}]+$/u, "Enter a name without control characters."),
  username: handle,
  categories: selection(CANONICAL_CATEGORY_LABELS),
  language: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .transform((value, ctx) => {
      try {
        return Intl.getCanonicalLocales(value)[0]!;
      } catch {
        ctx.addIssue({ code: "custom", message: "Enter a valid language tag." });
        return z.NEVER;
      }
    }),
  bundleIds: selection(bundles.map((bundle) => bundle.id)),
});
export const patch = form
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Supply a field to save.");

export function invalidForm(error: z.ZodError) {
  return new Unprocessable({
    message: "Check the onboarding fields.",
    details: { issues: error.issues.map(({ path, message }) => ({ path, message })) },
  });
}
