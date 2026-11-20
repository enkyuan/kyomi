import { ChevronDownIcon } from "@kyomi/ui/icons/blode";
import { BundleChoices } from "./bundle-choices";
import {
  requiredInterests,
  type OnboardingLanguageOption,
  type OnboardingStep,
} from "../lib/schema";

export function OnboardingField({
  step,
  categories,
  languages,
  value,
  onChange,
  errorId,
}: {
  step: OnboardingStep;
  categories: string[];
  languages: OnboardingLanguageOption[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  errorId?: string;
}) {
  const textValue = typeof value === "string" ? value : "";
  const selected = Array.isArray(value) ? value : [];

  function toggle(option: string) {
    onChange(
      selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option],
    );
  }

  switch (step) {
    case "username":
      return <UsernameInput value={textValue} onChange={onChange} errorId={errorId} />;
    case "language":
      return (
        <LanguageInput
          languages={languages}
          value={textValue}
          onChange={onChange}
          errorId={errorId}
        />
      );
    case "categories":
      return (
        <InterestChoices
          categories={categories}
          selected={selected}
          onSelect={toggle}
          errorId={errorId}
        />
      );
    case "bundleIds":
      return <BundleChoices selected={selected} onSelect={toggle} errorId={errorId} />;
  }
}

type TextFieldProps = {
  value: string;
  onChange: (value: string) => void;
  errorId?: string;
};

function UsernameInput({ value, onChange, errorId }: TextFieldProps) {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute start-3 top-0 grid h-11 place-items-center text-base text-muted-foreground sm:text-sm"
      >
        {"\u0040"}
      </span>
      <input
        aria-label="Username"
        aria-invalid={Boolean(errorId)}
        aria-describedby={errorId}
        className="h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base text-foreground outline-none transition-shadow placeholder:text-muted-subtle focus-visible:border-ring focus-visible:ring-(length:--field-ring-width) focus-visible:ring-ring/24 aria-invalid:border-destructive/64 aria-invalid:focus-visible:ring-destructive/16 sm:text-sm dark:bg-input/32 ps-8"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="username"
        maxLength={31}
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next.replace(/^@(?!@)/, ""));
        }}
      />
    </>
  );
}

function LanguageInput({
  languages,
  value,
  onChange,
  errorId,
}: TextFieldProps & { languages: OnboardingLanguageOption[] }) {
  return (
    <div className="relative">
      <select
        aria-label="Reading language"
        aria-invalid={Boolean(errorId)}
        aria-describedby={errorId}
        className="h-11 w-full appearance-none rounded-lg border border-input bg-background ps-3 pe-9 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring forced-colors:appearance-auto"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select a language</option>
        {languages.map(({ code, name }) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground [stroke-width:var(--icon-stroke)] forced-colors:hidden"
      />
    </div>
  );
}

function InterestChoices({
  categories,
  selected,
  onSelect,
  errorId,
}: {
  categories: string[];
  selected: string[];
  onSelect: (category: string) => void;
  errorId?: string;
}) {
  const selection = new Set(selected);
  const atLimit = selected.length >= requiredInterests;

  return (
    <fieldset aria-describedby={errorId} className="min-w-0">
      <legend className="sr-only">Interests</legend>
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const active = selection.has(category);
          return (
            <button
              key={category}
              type="button"
              aria-pressed={active}
              disabled={atLimit && !active}
              onClick={() => onSelect(category)}
              className="inline-flex min-h-8 min-w-0 max-w-full items-center rounded-full bg-muted px-3 py-1 text-start text-sm font-medium text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 disabled:opacity-(--opacity-disabled) pointer-coarse:min-h-11"
            >
              <span className="wrap-anywhere">{category}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
