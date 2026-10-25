"use client";

import { Switch } from "@kyomi/ui/components/switch";
import type { ReaderPreferences } from "@modules/reader/lib/preferences";
import { SettingHeading } from "./headings";

type ReaderSettingsProps = {
  preferences: ReaderPreferences;
  setPreferences: (next: Partial<ReaderPreferences>) => void;
};

export function ReaderSettings({ preferences, setPreferences }: ReaderSettingsProps) {
  return (
    <section className="space-y-3">
      <SettingHeading description="Choose how the reader treats your place." title="Reading" />
      <div className="space-y-3 py-1">
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
