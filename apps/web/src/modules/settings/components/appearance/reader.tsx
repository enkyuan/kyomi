"use client";

import { useMemo } from "react";
import { translationLanguages } from "@kyomi/reader/schemas/translation";
import { Switch } from "@kyomi/ui/components/switch";
import type { ReaderPreferences } from "@modules/reader/lib/preferences";
import { SettingHeading } from "./headings";

type ReaderSettingsProps = {
  preferences: ReaderPreferences;
  setPreferences: (next: Partial<ReaderPreferences>) => void;
};

export function ReaderSettings({ preferences, setPreferences }: ReaderSettingsProps) {
  const language = preferences.language ?? "en";
  const languages = useMemo(() => {
    const labels = new Intl.DisplayNames([language], { type: "language" });
    const order = new Intl.Collator(language);
    return [...new Set([language, ...translationLanguages])]
      .map((code) => ({ code, title: labels.of(code) ?? code }))
      .sort((a, b) => order.compare(a.title, b.title));
  }, [language]);
  return (
    <section className="space-y-3">
      <SettingHeading description="Customize your reading experience." title="Reading" />
      <div className="space-y-3 py-1">
        <label className="flex items-center justify-between gap-4 text-sm font-medium">
          Translation language
          <select
            value={language}
            className="rounded-md border bg-background px-2 py-1"
            onChange={(event) => setPreferences({ language: event.target.value })}
          >
            {languages.map((option) => (
              <option key={option.code} value={option.code}>
                {option.title}
              </option>
            ))}
          </select>
        </label>
        <label
          htmlFor="reader-remember-position"
          className="flex items-center justify-between gap-4"
        >
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">
              Remember reading position
            </span>
            <span className="block text-xs text-muted-foreground">
              Pick up where you left off on any device, and see unfinished articles under Continue
              reading.
            </span>
          </span>
          <Switch
            id="reader-remember-position"
            checked={preferences.rememberPosition}
            onCheckedChange={(checked) => setPreferences({ rememberPosition: checked })}
          />
        </label>
      </div>
    </section>
  );
}
