"use client";

import { SwitchFill } from "@mingcute/react";
import { SidebarMenuButton, SidebarMenuItem } from "@kyomi/ui/sidebar";

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
  return null;
}
