import { starterBundles } from "@kyomi/ingest/ingestion/starter-bundles";
import { translationLanguages } from "@kyomi/reader/schemas/translation";
import { z } from "zod";

export const onboardingSteps = ["username", "categories", "language", "bundleIds"] as const;
export const onboardingStepSchema = z.enum(onboardingSteps);
export type OnboardingStep = z.infer<typeof onboardingStepSchema>;
export const requiredInterests = 3;

const draftSchema = z.object({
  username: z.string().optional(),
  categories: z.array(z.string()).optional(),
  language: z.string().optional(),
  bundleIds: z.array(z.string()).optional(),
});
export type OnboardingDraft = z.infer<typeof draftSchema>;

export const onboardingStatusSchema = z.object({ status: z.enum(["pending", "complete"]) });
export const onboardingStateSchema = onboardingStatusSchema.extend({
  draft: draftSchema,
  nextField: onboardingStepSchema.nullable(),
});
export const onboardingDetailsSchema = onboardingStateSchema.extend({
  options: z.object({ categories: z.array(z.string()) }),
});
export type OnboardingState = z.infer<typeof onboardingStateSchema>;
export type OnboardingLanguageOption = { code: string; name: string };
export type OnboardingDetails = z.infer<typeof onboardingDetailsSchema> & {
  languages: OnboardingLanguageOption[];
};

export const usernameSchema = z
  .string()
  .trim()
  .regex(/^@?[a-zA-Z0-9_]{3,30}$/, "Use 3–30 letters, digits or underscores.")
  .transform((value) => value.replace(/^@/, "").toLowerCase());

const bundleIds = starterBundles.map((bundle) => bundle.id);

function selection<T extends string>(options: readonly T[]) {
  return z
    .array(z.enum(options, "Choose an option from the list."))
    .refine((values) => new Set(values).size === values.length, "Choose each option once.");
}

export function onboardingFields(categories: string[]) {
  return {
    username: usernameSchema,
    categories: selection(categories).length(requiredInterests, "Select 3 interests to continue."),
    language: z.enum(translationLanguages, "Choose a language."),
    bundleIds: selection(bundleIds).min(1, "Choose at least one starter bundle."),
  };
}

export const onboardingStepInput = z.object({
  step: onboardingStepSchema,
  value: z.union([z.string(), z.array(z.string())]),
});

export function resolveOnboardingStep(
  nextField: OnboardingStep | null,
  requested?: OnboardingStep,
) {
  const lastReachable = nextField ? onboardingSteps.indexOf(nextField) : onboardingSteps.length - 1;
  return requested ? Math.min(onboardingSteps.indexOf(requested), lastReachable) : lastReachable;
}
