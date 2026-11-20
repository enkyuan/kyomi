// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { HttpStatusError } from "@lib/status";
import { OnboardingPage } from "@modules/onboarding/page";
import { getOnboarding, saveOnboardingStep } from "@modules/onboarding/lib/api";
import {
  onboardingFields,
  onboardingSteps,
  type OnboardingDetails,
  type OnboardingStep,
} from "@modules/onboarding/lib/schema";

vi.mock("@modules/onboarding/lib/api", () => ({
  getOnboarding: vi.fn(),
  saveOnboardingStep: vi.fn(),
}));

const options = { categories: ["Technology", "Design & UX", "Science & Research", "Sports"] };
const languages = [
  { code: "fr", name: "French" },
  { code: "bn", name: "Bangla" },
  { code: "ba", name: "Bashkir" },
];
const initial: OnboardingDetails = {
  status: "pending",
  draft: {},
  nextField: "username",
  options,
  languages,
};
const finish = vi.fn(async () => {});
const expire = vi.fn(async () => {});
let saved: OnboardingDetails;

function Page({
  initialStep,
  state = saved,
}: {
  initialStep?: OnboardingStep;
  state?: OnboardingDetails;
}) {
  const [step, setStep] = useState(initialStep);
  return (
    <OnboardingPage
      initialState={state}
      requestedStep={step}
      onNavigate={setStep}
      onFinish={async (persist) => {
        await persist();
        await finish();
      }}
      onSessionExpired={expire}
    />
  );
}

function next() {
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  saved = initial;
  vi.mocked(getOnboarding).mockImplementation(async () => saved);
  vi.mocked(saveOnboardingStep).mockImplementation(async ({ data: { step, value } }) => {
    const nextField = onboardingSteps[onboardingSteps.indexOf(step) + 1] ?? null;
    saved = {
      options,
      languages,
      status: nextField ? "pending" : "complete",
      nextField,
      draft: { ...saved.draft, [step]: value },
    };
    return saved;
  });
});
afterEach(cleanup);

test("bounds deep links to username, reports field errors, and resumes the authenticated draft", async () => {
  const { unmount } = render(<Page initialStep="bundleIds" />);
  expect(screen.getByRole("heading", { name: "What should we call you?" })).toBeTruthy();
  const progress = screen.getByRole("progressbar", { name: "Onboarding progress" });
  expect(progress.getAttribute("aria-valuetext")).toBe("Step 1 of 4");
  const username = screen.getByRole("textbox", { name: "Username" });
  expect(username.tagName).toBe("INPUT");
  expect(username.previousElementSibling?.textContent).toBe("\u0040");
  expect(screen.queryByRole("textbox", { name: "Name", exact: true })).toBeNull();
  fireEvent.change(username, { target: { value: "@@ada" } });
  next();
  expect(screen.getByRole("alert").textContent).toContain("Use 3–30");
  expect(saveOnboardingStep).not.toHaveBeenCalled();
  vi.mocked(saveOnboardingStep).mockRejectedValueOnce(new HttpStatusError(409, "Taken"));
  fireEvent.change(username, { target: { value: "@Kyomi" } });
  next();
  expect((await screen.findByRole("alert")).textContent).toContain("taken");
  fireEvent.change(username, { target: { value: "@Ada_Reads" } });
  next();
  await screen.findByRole("heading", { name: "What do you like to read?" });
  expect(screen.getByRole("progressbar")).toBe(progress);
  expect(progress.getAttribute("aria-valuetext")).toBe("Step 2 of 4");
  expect(saveOnboardingStep).toHaveBeenLastCalledWith({
    data: { step: "username", value: "ada_reads" },
  });
  unmount();

  render(<Page initialStep="bundleIds" />);
  expect(screen.getByRole("heading", { name: "What do you like to read?" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByRole("textbox", { name: "Username" })).toHaveProperty("value", "ada_reads");
});

test("automatically opens the inbox after validating and saving the final bundle", async () => {
  saved = { ...initial, nextField: "categories", draft: { username: "ada_reads" } };
  render(<Page />);
  const technology = screen.getByRole<HTMLButtonElement>("button", { name: "Technology" });
  fireEvent.click(technology);
  fireEvent.click(screen.getByRole("button", { name: "Design & UX" }));
  expect(technology.form?.dataset.valid).toBe("false");
  next();
  expect(screen.getByRole("alert").textContent).toBe("Select 3 interests to continue.");
  fireEvent.click(screen.getByRole("button", { name: "Science & Research" }));
  expect(technology.form?.dataset.valid).toBe("true");
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Sports" }).disabled).toBe(true);
  next();
  const language = await screen.findByRole("combobox", { name: "Reading language" });
  expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
    "Select a language",
    ...languages.map(({ name }) => name),
  ]);
  next();
  expect(screen.getByRole("alert").textContent).toBe("Choose a language.");
  fireEvent.change(language, { target: { value: "fr" } });
  next();
  const bundle = await screen.findByRole("button", {
    name: "Climate & environment",
    description: /Climate science & policy.*Carbon Brief/,
  });
  fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));
  expect(screen.getByRole("alert").textContent).toBe("Choose at least one starter bundle.");
  expect(bundle.parentElement?.querySelectorAll('img[src^="/api/favicon?"]')).toHaveLength(4);
  fireEvent.click(bundle);
  expect(bundle.getAttribute("aria-pressed")).toBe("true");
  const arrival = Promise.withResolvers<void>();
  finish.mockReturnValueOnce(arrival.promise);
  const submit = screen.getByRole<HTMLButtonElement>("button", { name: "Finish setup" });
  await act(async () => fireEvent.click(submit));
  expect(finish).toHaveBeenCalledOnce();
  expect(saved.status).toBe("complete");
  expect(submit.disabled).toBe(true);
  expect(screen.queryByRole("heading", { name: "Your setup is complete" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Continue to inbox" })).toBeNull();
  await act(async () => arrival.resolve());
});

test("recovery routes a final username conflict back with progress intact", async () => {
  saved = {
    ...initial,
    nextField: "bundleIds",
    draft: { username: "ada_reads", categories: options.categories.slice(0, 3), language: "fr" },
  };
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "Technology" }));
  vi.mocked(saveOnboardingStep).mockRejectedValueOnce(new HttpStatusError(409, "Taken"));
  fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));
  expect((await screen.findByRole("alert")).textContent).toContain("taken");
  expect(screen.getByRole("textbox", { name: "Username" })).toHaveProperty("value", "ada_reads");
  expect(finish).not.toHaveBeenCalled();
});

test("retries inbox loading without saving the completed selection again", async () => {
  saved = {
    ...initial,
    nextField: "bundleIds",
    draft: { username: "ada_reads", categories: options.categories.slice(0, 3), language: "fr" },
  };
  finish.mockRejectedValueOnce(new Error("Retry"));
  render(<Page />);
  fireEvent.click(screen.getByRole("button", { name: "Technology" }));
  const submit = screen.getByRole("button", { name: "Finish setup" });
  fireEvent.click(submit);
  expect((await screen.findByRole("alert")).textContent).toContain("Couldn’t load your inbox");
  fireEvent.click(submit);
  await waitFor(() => expect(finish).toHaveBeenCalledTimes(2));
  expect(saveOnboardingStep).toHaveBeenCalledOnce();
});

test("checks the selection values against their allowed options", () => {
  const fields = onboardingFields(options.categories);
  expect(fields.categories.safeParse(["Technology", "Technology", "Design & UX"]).success).toBe(
    false,
  );
  expect(fields.categories.safeParse(["Unknown", "Technology", "Design & UX"]).success).toBe(false);
  expect(fields.language.safeParse("fr").success).toBe(true);
  expect(fields.language.safeParse("invalid").success).toBe(false);
  expect(fields.bundleIds.safeParse(["science", "science"]).success).toBe(false);
  expect(fields.bundleIds.safeParse(["unknown"]).success).toBe(false);
});
