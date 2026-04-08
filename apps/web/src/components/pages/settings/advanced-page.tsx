"use client";

import { PhoneFill, Settings3Fill } from "@mingcute/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { SidebarMenuButton, SidebarMenuItem } from "@components/ui/sidebar";

export const advancedSection = {
  description: "Update advanced preferences and account-level controls.",
  icon: Settings3Fill,
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
        <Settings3Fill />
        <span>{advancedSection.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AdvancedPagePanel() {
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
              <advancedSection.icon className="size-5" />
            </div>
            <div className="min-w-0">
              <CardTitle>{advancedSection.name}</CardTitle>
              <CardDescription className="mt-1">{advancedSection.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preferences</CardTitle>
          <CardDescription>Advanced settings content will be added here.</CardDescription>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Support</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <PhoneFill className="size-4 shrink-0" />
            <span>Support and feedback actions remain available in the sidebar.</span>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
