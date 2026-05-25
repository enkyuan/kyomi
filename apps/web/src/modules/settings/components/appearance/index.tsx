"use client";

import { BrushFill } from "@mingcute/react";
import { Button } from "@vols.rss/ui/button";
import { SidebarMenuButton, SidebarMenuItem } from "@vols.rss/ui/sidebar";
import { InboxAppearanceSettings } from "./inbox-settings";
import { ReaderAppearanceSettings } from "./reader-settings";
import { ThemeSwitcher } from "./theme-switcher";
import { useAppearancePanel } from "@modules/settings/hooks/use-appearance-panel";
import { SectionSeparator } from "./section-separator";

export const appearanceSection = {
  description: "Adjust theme, inbox presentation, and reader display.",
  icon: BrushFill,
  name: "Appearance",
} as const;

type AppearancePageNavProps = {
  isActive: boolean;
  onSelect: () => void;
};

const APPEARANCE_SUBSECTION_SPACING_CLASS = "space-y-4";

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
    inboxLimits,
    inboxPreferences,
    readerLimits,
    readerPreferences,
    ready,
    resetAll,
    setInboxPreferences,
    setReaderPreferences,
  } = useAppearancePanel();

  if (!ready) {
    return null;
  }

  return (
    <div className={APPEARANCE_SUBSECTION_SPACING_CLASS}>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Appearance</h3>
          <Button size="sm" variant="outline" onClick={resetAll}>
            Reset defaults
          </Button>
        </div>
        <ThemeSwitcher />
      </section>

      <SectionSeparator />

      <InboxAppearanceSettings
        limits={inboxLimits}
        preferences={inboxPreferences}
        setPreferences={setInboxPreferences}
      />

      <SectionSeparator />

      <ReaderAppearanceSettings
        limits={readerLimits}
        preferences={readerPreferences}
        setPreferences={setReaderPreferences}
      />
    </div>
  );
}
