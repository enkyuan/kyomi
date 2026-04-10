"use client";

import { useState } from "react";
import { BookmarkFill } from "@mingcute/react";
import { DownFill } from "@mingcute/react";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@components/ui/sidebar";
import { cn } from "@lib/utils";

const pinnedItems = [
  { label: "Watchlists", icon: BookmarkFill },
  { label: "Accounts", icon: BookmarkFill },
];

export function SidebarPinnedSection() {
  const [pinnedOpen, setPinnedOpen] = useState(true);

  return (
    <SidebarGroup className="gap-1">
      <Collapsible onOpenChange={setPinnedOpen} open={pinnedOpen}>
        <CollapsibleTrigger className="w-full">
          <SidebarGroupLabel className="w-full cursor-pointer justify-between">
            <span>Pinned</span>
            <DownFill
              className={cn(
                "size-4 transition-transform duration-200",
                !pinnedOpen && "-rotate-90",
              )}
            />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsiblePanel>
          <SidebarMenu>
            {pinnedItems.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  disabled
                  tooltip={item.label}
                  className="cursor-default opacity-72"
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </CollapsiblePanel>
      </Collapsible>
    </SidebarGroup>
  );
}
