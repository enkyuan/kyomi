"use client";

import { ArrowUpCircleFill, Chat3Fill, Settings3Fill } from "@mingcute/react";
import { FeedbackDialog } from "@vols.rss/ui/feedback-dialog";
import { SidebarModeAnimatedText } from "@vols.rss/ui/sidebar-mode-animated-text";
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@vols.rss/ui/sidebar";

const FOOTER_ICONS = {
  upgrade: ArrowUpCircleFill,
  feedback: Chat3Fill,
  settings: Settings3Fill,
} as const;

const FOOTER_NAV = [
  { label: "Upgrade Plan", iconKey: "upgrade" as const },
  { label: "Feedback", iconKey: "feedback" as const },
  { label: "Settings", iconKey: "settings" as const },
];

export function FooterActions({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <SidebarFooter className="px-2 pb-2 pt-0">
      <SidebarMenu>
        {FOOTER_NAV.map((item) => {
          const Icon = FOOTER_ICONS[item.iconKey];
          const isSettings = item.label === "Settings";
          const isUpgrade = item.label === "Upgrade Plan";

          return (
            <SidebarMenuItem key={item.label}>
              {item.label === "Feedback" ? (
                <FeedbackDialog
                  trigger={
                    <SidebarMenuButton tooltip={item.label} className="opacity-72">
                      <Icon />
                      <SidebarModeAnimatedText>{item.label}</SidebarModeAnimatedText>
                    </SidebarMenuButton>
                  }
                />
              ) : (
                <SidebarMenuButton
                  tooltip={item.label}
                  className="opacity-72"
                  disabled={isUpgrade}
                  onClick={isSettings ? onOpenSettings : undefined}
                >
                  <Icon />
                  <SidebarModeAnimatedText>{item.label}</SidebarModeAnimatedText>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarFooter>
  );
}
