"use client";

import { BrainIcon } from "@kyomi/ui/icons/blode";
import { SidebarMenuButton, SidebarMenuItem } from "@kyomi/ui/components/sidebar";

export const personalizationSection = {
  name: "Personalization",
} as const;

type PersonalizationPageNavProps = {
  isActive: boolean;
  onSelect: () => void;
};

export function PersonalizationPageNav({ isActive, onSelect }: PersonalizationPageNavProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} onClick={onSelect}>
        <BrainIcon />
        <span>{personalizationSection.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function PersonalizationPagePanel() {
  return null;
}
