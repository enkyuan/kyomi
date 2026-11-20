import {
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PropsWithChildren,
} from "react";
import { Button } from "@kyomi/ui/components/button";
import { Progress, ProgressIndicator, ProgressTrack } from "@kyomi/ui/components/progress";
import { TextMorph } from "@kyomi/ui/components/text-morph";
import { useMediaQuery } from "@kyomi/ui/hooks/use-media-query";
import { cn } from "@kyomi/ui/lib/utils";
import { modelLanguage } from "@kyomi/reader/schemas/translation";
import { getErrorStatus } from "@lib/status";
import { AccountHeader } from "@modules/auth/components/account-header";
import { BundleChoices } from "./components/bundle-choices";
import { OnboardingField } from "./components/fields";
import { InboxArrivalTransition } from "./lib/arrival-transition";
import { getOnboarding, saveOnboardingStep } from "./lib/api";
import {
  requiredInterests,
  onboardingSteps,
  onboardingFields,
  resolveOnboardingStep,
  type OnboardingDetails,
  type OnboardingDraft,
  type OnboardingLanguageOption,
  type OnboardingState,
  type OnboardingStep,
} from "./lib/schema";

const steps = {
  username: {
    title: "What should we call you?",
    description: "Use 3–30 letters, digits, or underscores.",
  },
  categories: {
    title: "What do you like to read?",
    description: `Select ${requiredInterests} interests to follow.`,
  },
  language: {
    title: "Preferred language",
    description: "Used for article translations. You can change this later.",
  },
  bundleIds: {
    title: "Add some starter feeds",
    description: "Choose one or more bundles to get you going.",
  },
};

const emptyStepValues: Record<OnboardingStep, string | string[]> = {
  username: "",
  categories: [],
  language: "",
  bundleIds: [],
};

type OnboardingPageProps = {
  initialState: OnboardingDetails;
  requestedStep?: OnboardingStep;
  onNavigate: (step: OnboardingStep) => void;
  onSessionExpired: () => Promise<void>;
  onFinish: (finishSetup: () => Promise<void>, button: HTMLButtonElement | null) => Promise<void>;
};

function OnboardingLayout({ children, onBack }: PropsWithChildren<{ onBack?: () => void }>) {
  return (
    <main className="relative grid min-h-dvh items-start justify-items-center px-6 py-30 sm:items-center sm:py-32">
      <AccountHeader onBack={onBack} />
      <section className="w-full max-w-lg">{children}</section>
    </main>
  );
}

export function OnboardingPage({
  initialState,
  requestedStep,
  onNavigate,
  onSessionExpired,
  onFinish,
}: OnboardingPageProps) {
  const [session, setSession] = useState<OnboardingState>(initialState);
  const [saving, setSaving] = useState(false);
  const [issue, setIssue] = useState<{ step: OnboardingStep; message: string }>();
  const submitting = useRef(false);
  const submitButton = useRef<HTMLButtonElement>(null);
  const index = resolveOnboardingStep(session.nextField, requestedStep);
  const step = onboardingSteps[index]!;
  const previous = session.status === "complete" ? undefined : onboardingSteps[index - 1];
  const submitLabel = step === "bundleIds" ? "Finish setup" : "Continue";
  const { setCaptureReady } = use(InboxArrivalTransition);

  useEffect(() => {
    if (step !== "bundleIds") return;
    setCaptureReady(true);
    return () => setCaptureReady(false);
  }, [step, setCaptureReady]);

  function markComplete() {
    // Keep the submitted step in place until Glimm commits the navigation.
    setSession((current) => ({ ...current, status: "complete" }));
  }

  async function save(value: string | string[]) {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setIssue(undefined);
    let completed = session.status === "complete";

    async function persist() {
      try {
        return await saveOnboardingStep({ data: { step, value } });
      } catch (error) {
        if (getErrorStatus(error) !== 409) throw error;
        const current = await getOnboarding();
        if (current.status === "complete") return current;
        setSession(current);
        throw error;
      }
    }

    async function finishSetup() {
      if (completed) return;
      const state = await persist();
      if (state.status !== "complete") throw new Error("Onboarding is still pending.");
      completed = true;
      markComplete();
    }

    try {
      if (step === "bundleIds" || completed) {
        await onFinish(finishSetup, submitButton.current);
        return;
      }
      const state = await persist();
      if (state.status === "complete") {
        completed = true;
        markComplete();
        await onFinish(finishSetup, submitButton.current);
      } else {
        setSession(state);
        const next = onboardingSteps[index + 1] ?? state.nextField;
        if (next) onNavigate(next);
      }
    } catch (error) {
      const status = getErrorStatus(error);
      if (status === 401) {
        await onSessionExpired();
      } else if (completed) {
        setIssue({ step, message: "Couldn’t load your inbox. Try again." });
      } else if (status === 409) {
        setIssue({ step: "username", message: "This username is taken. Choose another." });
        onNavigate("username");
      } else {
        setIssue({ step, message: "Couldn’t save this step. Try again." });
      }
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <OnboardingLayout onBack={previous && !saving ? () => onNavigate(previous) : undefined}>
      <div className="group/step space-y-7" aria-busy={saving}>
        <StepHeader step={step} index={index} />
        <div className="relative grid items-start">
          {/* Reserve the tallest step's height without creating controls or fetching icons. */}
          <div
            inert
            aria-hidden="true"
            className="invisible col-start-1 row-start-1 hidden gap-7 sm:grid"
          >
            <BundleChoices selected={[]} />
            <div className="h-11" />
          </div>
          <div
            className={cn(
              "col-start-1 row-start-1 grid gap-7",
              // Keep the bundle step anchored at its compact position as the rows grow.
              step === "bundleIds" && "sm:absolute sm:inset-x-0 sm:top-0",
            )}
          >
            <OnboardingStepForm
              key={step}
              step={step}
              draft={session.draft}
              categories={initialState.options.categories}
              languages={initialState.languages}
              serverError={issue?.step === step ? issue.message : undefined}
              onEdit={() => setIssue(undefined)}
              onContinue={save}
            />
            <Button
              ref={submitButton}
              type="submit"
              form="onboarding-step"
              size="xl"
              aria-label={submitLabel}
              loading={saving}
              disabled={saving}
              className="group/continue min-h-11 w-full group-has-[form[data-valid=true]]/step:border-matcha"
            >
              <TextMorph scale={false}>{submitLabel}</TextMorph>
              {!saving && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 grid place-items-center rounded-[inherit] bg-matcha text-matcha-foreground [--matcha-hidden:0_100%_0_0] rtl:[--matcha-hidden:0_0_0_100%] [clip-path:inset(var(--matcha-hidden))] group-has-[form[data-valid=true]]/step:[clip-path:inset(0)] transition-[clip-path,filter] duration-(--duration-control) ease-out-quint group-hover/continue:brightness-95 motion-reduce:transition-none"
                >
                  <TextMorph scale={false}>{submitLabel}</TextMorph>
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </OnboardingLayout>
  );
}

function StepHeader({ step, index }: { step: OnboardingStep; index: number }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const narrow = useMediaQuery("max-sm");
  const count = index + 1;
  const total = onboardingSteps.length;

  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  return (
    <header className="space-y-3">
      <div className="flex items-center gap-4">
        <Progress
          className="min-w-0 max-w-31 flex-1"
          value={count}
          max={total}
          aria-label="Onboarding progress"
          aria-valuetext={`Step ${count} of ${total}`}
        >
          <ProgressTrack>
            <ProgressIndicator className="transition-[width] duration-(--duration-overlay) ease-out-quint motion-reduce:transition-none" />
          </ProgressTrack>
        </Progress>
        <span
          aria-hidden="true"
          className="ms-auto shrink-0 text-end whitespace-nowrap text-sm text-muted-foreground tabular-nums"
        >
          Step <TextMorph scale={false}>{String(count)}</TextMorph> of {total}
        </span>
      </div>
      <h1
        ref={heading}
        tabIndex={-1}
        className="text-balance text-2xl font-semibold tracking-tight outline-none"
      >
        <TextMorph scale={false} disabled={narrow}>
          {steps[step].title}
        </TextMorph>
      </h1>
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
        <TextMorph scale={false} disabled={narrow}>
          {steps[step].description}
        </TextMorph>
      </p>
    </header>
  );
}

function OnboardingStepForm({
  step,
  draft,
  categories,
  languages,
  serverError,
  onEdit,
  onContinue,
}: {
  step: OnboardingStep;
  draft: OnboardingDraft;
  categories: string[];
  languages: OnboardingLanguageOption[];
  serverError?: string;
  onEdit: () => void;
  onContinue: (value: string | string[]) => Promise<void>;
}) {
  const [value, setValue] = useState(
    step === "language"
      ? (modelLanguage(draft.language ?? "") ?? "")
      : (draft[step] ?? emptyStepValues[step]),
  );
  const [error, setError] = useState<string>();

  function update(value: string | string[]) {
    setValue(value);
    setError(undefined);
    onEdit();
  }

  const fields = useMemo(() => onboardingFields(categories), [categories]);
  const parsed = fields[step].safeParse(value);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check this field and try again.");
      return;
    }
    void onContinue(parsed.data);
  }

  const fieldError = error ?? serverError;
  const errorId = fieldError ? "onboarding-error" : undefined;

  return (
    <form
      id="onboarding-step"
      data-valid={parsed.success && !fieldError}
      onSubmit={submit}
      noValidate
    >
      <div className="relative space-y-2">
        <OnboardingField
          step={step}
          categories={categories}
          languages={languages}
          value={value}
          onChange={update}
          errorId={errorId}
        />
        {fieldError && (
          <p id="onboarding-error" role="alert" className="text-sm text-destructive-foreground">
            {fieldError}
          </p>
        )}
      </div>
    </form>
  );
}
