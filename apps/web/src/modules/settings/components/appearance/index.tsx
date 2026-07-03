"use client";

import { BrushFill } from "@mingcute/react";
import { Button } from "@kyomi/ui/button";
import { SidebarMenuButton, SidebarMenuItem } from "@kyomi/ui/sidebar";
import { InboxAppearanceSettings } from "./inbox-settings";
import { ThemeSwitcher } from "./theme-switcher";
import { useAppearancePanel } from "@modules/settings/hooks/appearance";

export const appearanceSection = {
  description: "Adjust theme and inbox presentation.",
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
  const { inboxPreferences, ready, resetAll, setInboxPreferences } = useAppearancePanel();

  if (!ready) {
    return null;
  }

  return (
    <div className={APPEARANCE_SUBSECTION_SPACING_CLASS}>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground">Appearance</h3>
          <Button size="sm" variant="outline" onClick={resetAll}>
            Reset defaults
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <ThemeSwitcher />
      </section>

      <InboxAppearanceSettings
        preferences={inboxPreferences}
        setPreferences={setInboxPreferences}
      />
      {/* Reader settings were removed from Appearance for now. The removed section contained:
          default reader mode, font size, content width, open links in new tab, link previews on
          hover, and show images controls. */}
    </div>
  );
}
