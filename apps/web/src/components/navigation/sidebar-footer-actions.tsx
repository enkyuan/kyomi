"use client";

import { ArrowUpCircleFill, Chat3Fill, Settings3Fill } from "@mingcute/react";
import { FeedbackDialog } from "@components/ui/feedback-dialog";
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@components/ui/sidebar";

const FOOTER_NAV = [
  { label: "Upgrade Plan", icon: ArrowUpCircleFill },
  { label: "Feedback", icon: Chat3Fill },
  { label: "Settings", icon: Settings3Fill },
];

export function SidebarFooterActions({ onOpenSettings }: { onOpenSettings: () => void }) {
  return (
    <SidebarFooter className="px-2 pb-2 pt-0">
      <SidebarMenu>
        {FOOTER_NAV.map((item) => {
          const isSettings = item.label === "Settings";
          const isUpgrade = item.label === "Upgrade Plan";

          return (
            <SidebarMenuItem key={item.label}>
              {item.label === "Feedback" ? (
                <FeedbackDialog
                  trigger={
                    <SidebarMenuButton tooltip={item.label} className="opacity-72">
                      <item.icon />
                      <span>{item.label}</span>
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
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarFooter>
  );
}
