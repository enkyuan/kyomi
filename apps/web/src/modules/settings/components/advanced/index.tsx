"use client";

import { ToggleIcon } from "@kyomi/ui/icons/blode";
import { SidebarMenuButton, SidebarMenuItem } from "@kyomi/ui/components/sidebar";

export const advancedSection = {
  description: "Update advanced preferences and account-level controls.",
  icon: ToggleIcon,
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
        <ToggleIcon />
        <span>{advancedSection.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AdvancedPagePanel() {
  return null;
}
