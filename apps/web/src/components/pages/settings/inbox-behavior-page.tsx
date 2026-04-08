"use client";

import { InboxFill, PhoneFill } from "@mingcute/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { SidebarMenuButton, SidebarMenuItem } from "@components/ui/sidebar";

export const inboxBehaviorSection = {
  description: "Control saved views, starring, and default sorting behavior.",
  icon: InboxFill,
  name: "Inbox Behavior",
} as const;

type InboxBehaviorPageNavProps = {
  isActive: boolean;
  onSelect: () => void;
};

export function InboxBehaviorPageNav({ isActive, onSelect }: InboxBehaviorPageNavProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} onClick={onSelect}>
        <InboxFill />
        <span>{inboxBehaviorSection.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function InboxBehaviorPagePanel() {
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
              <inboxBehaviorSection.icon className="size-5" />
            </div>
            <div className="min-w-0">
              <CardTitle>{inboxBehaviorSection.name}</CardTitle>
              <CardDescription className="mt-1">{inboxBehaviorSection.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preferences</CardTitle>
          <CardDescription>Inbox behavior settings content will be added here.</CardDescription>
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
