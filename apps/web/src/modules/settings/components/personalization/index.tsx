"use client";

import { HeadAiFill } from "@kyomi/ui/icons/mingcute";
import { SidebarMenuButton, SidebarMenuItem } from "@kyomi/ui/sidebar";

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
        <HeadAiFill />
        <span>{personalizationSection.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function PersonalizationPagePanel() {
  return null;
}
