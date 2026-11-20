import { CANONICAL_CATEGORY_LABELS } from "@kyomi/db";
import { z } from "zod";
import { Unprocessable } from "@shared/effect/errors";
import { starterBundles as bundles } from "@kyomi/ingest/ingestion/starter-bundles";
import { modelLanguage } from "@kyomi/reader/schemas/translation";

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
  username: handle,
  categories: selection(CANONICAL_CATEGORY_LABELS).refine(
    (values) => values.length === 3,
    "Select 3 interests to continue.",
  ),
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
    })
    .refine((locale) => modelLanguage(locale) !== null, "Choose a supported language."),
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
