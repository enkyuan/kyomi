"use client";

import { InboxFill, PhoneFill } from "@mingcute/react";
import { SidebarMenuButton, SidebarMenuItem } from "@components/ui/sidebar";

export const inboxSection = {
  description: "Control saved views, starring, and default sorting behavior.",
  icon: InboxFill,
  name: "Inbox",
} as const;

type InboxPageNavProps = {
  isActive: boolean;
  onSelect: () => void;
};

export function InboxPageNav({ isActive, onSelect }: InboxPageNavProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton isActive={isActive} onClick={onSelect}>
        <InboxFill />
        <span>{inboxSection.name}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function InboxPagePanel() {
  return (
    <>
      <section className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40">
            <inboxSection.icon className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{inboxSection.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{inboxSection.description}</p>
          </div>
        </div>
      </section>
      <section className="space-y-1">
        <h3 className="text-sm font-semibold">Preferences</h3>
        <p className="text-sm text-muted-foreground">Inbox settings content will be added here.</p>
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
