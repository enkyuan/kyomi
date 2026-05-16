"use client";

import { BrushFill } from "@mingcute/react";
import { Button } from "@components/ui/button";
import { SidebarMenuButton, SidebarMenuItem } from "@components/ui/sidebar";
import { useInboxPreferences } from "@lib/inbox-preferences";
import { useReaderPreferences } from "@lib/reader-preferences";
import { InboxAppearanceSettings } from "./appearance-inbox-settings";
import { ReaderAppearanceSettings } from "./appearance-reader-settings";
import { ThemeSwitcher } from "./theme-switcher";

export const appearanceSection = {
  description: "Adjust theme, inbox presentation, and reader display.",
  icon: BrushFill,
  name: "Appearance",
} as const;

type AppearancePageNavProps = {
  isActive: boolean;
  onSelect: () => void;
};

const APPEARANCE_SUBSECTION_SPACING_CLASS = "space-y-8";

export function AppearancePageNav({ isActive, onSelect }: AppearancePageNavProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} onClick={onSelect}>
        <BrushFill />
        <span>{appearanceSection.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppearancePagePanel() {
  const {
    limits: inboxLimits,
    preferences: inboxPreferences,
    resetPreferences: resetInboxPreferences,
    setPreferences: setInboxPreferences,
  } = useInboxPreferences();
  const {
    limits: readerLimits,
    preferences: readerPreferences,
    resetPreferences: resetReaderPreferences,
    setPreferences: setReaderPreferences,
  } = useReaderPreferences();

  if (!inboxPreferences || !readerPreferences) {
    return null;
  }

  const handleResetAll = () => {
    resetInboxPreferences();
    resetReaderPreferences();
  };

  return (
    <div className={APPEARANCE_SUBSECTION_SPACING_CLASS}>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Appearance</h3>
          <Button size="sm" variant="outline" onClick={handleResetAll}>
            Reset defaults
          </Button>
        </div>
        <ThemeSwitcher />
      </section>

      <InboxAppearanceSettings
        limits={inboxLimits}
        preferences={inboxPreferences}
        setPreferences={setInboxPreferences}
      />

      <ReaderAppearanceSettings
        limits={readerLimits}
        preferences={readerPreferences}
        setPreferences={setReaderPreferences}
      />
    </div>
  );
}
