"use client";

import { PhoneFill, SwitchFill } from "@mingcute/react";
import { SidebarMenuButton, SidebarMenuItem } from "@components/ui/sidebar";

export const advancedSection = {
  description: "Update advanced preferences and account-level controls.",
  icon: SwitchFill,
  name: "Advanced",
} as const;

type AdvancedPageNavProps = {
  isActive: boolean;
  onSelect: () => void;
};

export function AdvancedPageNav({ isActive, onSelect }: AdvancedPageNavProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} onClick={onSelect}>
        <SwitchFill />
        <span>{advancedSection.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AdvancedPagePanel() {
  return (
    <>
      <section className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
            <advancedSection.icon className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{advancedSection.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{advancedSection.description}</p>
          </div>
        </div>
      </section>
      <section className="space-y-1">
        <h3 className="text-sm font-semibold">Preferences</h3>
        <p className="text-sm text-muted-foreground">
          Advanced settings content will be added here.
        </p>
      </section>
      <section className="space-y-1">
        <h3 className="text-sm font-semibold">Support</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <PhoneFill className="size-4 shrink-0" />
          <span>Support and feedback actions remain available in the sidebar.</span>
        </div>
      </section>
    </>
  );
}
