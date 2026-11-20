import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, setResponseHeader } from "@tanstack/react-start/server";
import { translationLanguages } from "@kyomi/reader/schemas/translation";
import { z } from "zod";
import { apiJson, buildForwardHeaders } from "@lib/api";
import { getErrorStatus, HttpStatusError } from "@lib/status";
import {
  onboardingDetailsSchema,
  onboardingStatusSchema,
  onboardingStepInput,
  onboardingStateSchema,
  type OnboardingDetails,
  usernameSchema,
} from "./schema";

const path = "/api/v1/me/onboarding";
const availabilitySchema = z.object({ available: z.boolean() });
const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
// Serialize labels and order once. ICU data can differ between server and browser.
const languages = translationLanguages
  .map((code) => ({ code, name: displayNames.of(code === "ns" ? "nso" : code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

function onboardingHeaders() {
  setResponseHeader("Cache-Control", "private, no-store");
  return buildForwardHeaders(getRequestHeaders());
}

export const getOnboardingStatus = createServerFn({ method: "GET" }).handler(async () => {
  const headers = onboardingHeaders();
  return onboardingStatusSchema.parse(await apiJson(path + "/status", { headers }));
});

export const getOnboarding = createServerFn({ method: "GET" }).handler(
  async (): Promise<OnboardingDetails> => {
    const headers = onboardingHeaders();
    const state = onboardingDetailsSchema.parse(await apiJson(path, { headers }));
    return { ...state, languages };
  },
);

export const saveOnboardingStep = createServerFn({ method: "POST" })
  .validator(onboardingStepInput)
  .handler(async ({ data }) => {
    const headers = onboardingHeaders();
    headers.set("content-type", "application/json");

    if (data.step === "username") {
      const username = usernameSchema.parse(data.value);
      const query = new URLSearchParams({ username });
      const { available } = availabilitySchema.parse(
        await apiJson(`${path}/username?${query}`, { headers }),
      );
      if (!available) throw new HttpStatusError(409, "This username is taken.");
    }

    try {
      const saved = onboardingStateSchema.parse(
        await apiJson(path, {
          method: "PATCH",
          body: JSON.stringify({ [data.step]: data.value }),
          headers,
        }),
      );
      if (data.step !== "bundleIds") return saved;
    } catch (error) {
      if (getErrorStatus(error) !== 409) throw error;
      // Another tab may have already completed onboarding for this account.
      const current = onboardingStateSchema.parse(await apiJson(path, { headers }));
      if (current.status === "complete") return current;
      throw error;
    }

    return onboardingStateSchema.parse(
      await apiJson(path + "/completion", { method: "PUT", headers }),
    );
  });
