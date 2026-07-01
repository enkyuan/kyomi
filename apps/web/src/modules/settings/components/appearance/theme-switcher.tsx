"use client";

import { useEffect, useState } from "react";
import { Field, FieldItem, FieldLabel } from "@kyomi/ui/field";
import { Fieldset, FieldsetLegend } from "@kyomi/ui/fieldset";
import { Radio, RadioGroup } from "@kyomi/ui/radio-group";

const THEME_STORAGE_KEY = "theme";

const items = [
  { label: "System", value: "system" },
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
] as const;

type ThemeOption = (typeof items)[number]["value"];
type StoredThemeMode = "auto" | "dark" | "light";

function readStoredTheme(): ThemeOption {
  if (typeof window === "undefined") {
    return "system";
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  if (stored === "auto") {
    return "system";
  }
  return "system";
}

function applyTheme(next: ThemeOption) {
  if (typeof window === "undefined") {
    return;
  }

  const mode: StoredThemeMode = next === "system" ? "auto" : next;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;
  const root = document.documentElement;

  window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  root.classList.remove("light", "dark");
  root.classList.add(resolved);

  if (mode === "auto") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", mode);
  }

  root.style.colorScheme = resolved;
}

export function ThemeSwitcher() {
  const [value, setValue] = useState<ThemeOption>(() => readStoredTheme());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const current = readStoredTheme();
      setValue(current);
      if (current === "system") {
        applyTheme(current);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  return (
    <Field
      className="gap-4"
      name="theme"
      render={(props) => <Fieldset {...props} className="max-w-none gap-4" />}
    >
      <div className="space-y-1">
        <FieldsetLegend className="font-medium text-sm">Theme</FieldsetLegend>
        <p className="text-xs text-muted-foreground">Choose how kyomi appears across the app.</p>
      </div>
      <RadioGroup
        className="flex-row gap-4"
        value={value}
        onValueChange={(next) => {
          if (next !== "system" && next !== "light" && next !== "dark") {
            return;
          }
          setValue(next);
          applyTheme(next);
        }}
      >
        {items.map((item) => (
          <FieldItem key={item.value}>
            <FieldLabel className="cursor-pointer flex-col">
              <Radio className="peer absolute sr-only" value={item.value} />
              <span className="relative block h-17.5 w-22 overflow-hidden rounded-lg shadow-xs transition-shadow peer-data-disabled:cursor-not-allowed peer-data-disabled:opacity-64 peer-data-checked:ring-2 peer-data-checked:ring-primary/48 peer-data-checked:ring-offset-1 peer-data-checked:ring-offset-background not-peer-data-checked:opacity-80">
                {themePreviews[item.value]}
              </span>
              <span className="not-peer-data-checked:text-muted-foreground/70">{item.label}</span>
            </FieldLabel>
          </FieldItem>
        ))}
      </RadioGroup>
    </Field>
  );
}

const themePreviews = {
  dark: (
    <svg
      aria-hidden
      className="size-full"
      fill="none"
      viewBox="0 0 88 70"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path className="fill-neutral-900" d="M0 0h88v70H0z" />
      <path className="fill-neutral-800 shadow-sm" d="M10 12a4 4 0 0 1 4-4h74v62H10V12Z" />
      <circle className="fill-neutral-600" cx="28" cy="26" r="8" />
      <rect className="fill-neutral-700" height="4" rx="2" width="58" x="20" y="42" />
      <rect className="fill-neutral-700" height="4" rx="2" width="58" x="20" y="49" />
      <rect className="fill-neutral-700" height="4" rx="2" width="29" x="20" y="56" />
    </svg>
  ),
  light: (
    <svg
      aria-hidden
      className="size-full"
      fill="none"
      viewBox="0 0 88 70"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path className="fill-neutral-200" d="M0 0h88v70H0z" />
      <path className="fill-white shadow-sm" d="M10 12a4 4 0 0 1 4-4h74v62H10V12Z" />
      <circle className="fill-neutral-300" cx="28" cy="26" r="8" />
      <rect className="fill-neutral-200" height="4" rx="2" width="58" x="20" y="42" />
      <rect className="fill-neutral-200" height="4" rx="2" width="58" x="20" y="49" />
      <rect className="fill-neutral-200" height="4" rx="2" width="29" x="20" y="56" />
    </svg>
  ),
  system: (
    <svg
      aria-hidden
      className="size-full"
      fill="none"
      viewBox="0 0 88 70"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path className="fill-neutral-200" d="M0 0h44v70H0z" />
      <path className="fill-neutral-900" d="M44 0h44v70H44z" />
      <path className="fill-white shadow-sm" d="M10 12a4 4 0 0 1 4-4h30v62H10V12Z" />
      <circle className="fill-neutral-300" cx="28" cy="26" r="8" />
      <path
        className="fill-neutral-200"
        d="M20 44a2 2 0 0 1 2-2h22v4H22a2 2 0 0 1-2-2ZM20 51a2 2 0 0 1 2-2h22v4H22a2 2 0 0 1-2-2ZM20 58a2 2 0 0 1 2-2h22v4H22a2 2 0 0 1-2-2Z"
      />
      <path className="fill-neutral-800 shadow-sm" d="M54 12a4 4 0 0 1 4-4h30v62H54V12Z" />
      <circle className="fill-neutral-600" cx="72" cy="26" r="8" />
      <path
        className="fill-neutral-700"
        d="M64 44a2 2 0 0 1 2-2h22v4H66a2 2 0 0 1-2-2ZM64 51a2 2 0 0 1 2-2h22v4H66a2 2 0 0 1-2-2ZM64 58a2 2 0 0 1 2-2h22v4H66a2 2 0 0 1-2-2Z"
      />
    </svg>
  ),
} as const;
