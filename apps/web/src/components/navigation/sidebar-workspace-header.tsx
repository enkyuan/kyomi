"use client";

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BookmarkFill,
  Calendar3Fill,
  NewsFill,
  SelectorVerticalLine,
  StarFill,
} from "@mingcute/react";
import {
  Command,
  CommandDialog,
  CommandDialogPopup,
  CommandDialogTrigger,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
  CommandShortcut,
} from "@components/ui/command";
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@components/ui/sidebar";
import { SidebarFeedSearchTrigger } from "@components/navigation/sidebar-feed-search";

export function SidebarWorkspaceHeader({ isMacPlatform }: { isMacPlatform: boolean }) {
  const navigate = useNavigate();
  const [commandOpen, setCommandOpen] = useState(false);

  const commandItems = [
    {
      label: "Today",
      shortcut: "G I",
      icon: Calendar3Fill,
      action: () =>
        navigate({
          to: "/inbox",
          search: () => ({
            filter: "today" as const,
            itemId: undefined,
          }),
        }),
    },
    {
      label: "All Unread",
      shortcut: "G U",
      icon: NewsFill,
      action: () =>
        navigate({
          to: "/inbox",
          search: (prev) => ({
            ...prev,
            filter: "unread",
            itemId: undefined,
          }),
        }),
    },
    {
      label: "Read Later",
      shortcut: "G S",
      icon: StarFill,
      action: () =>
        navigate({
          to: "/inbox",
          search: (prev) => ({
            ...prev,
            filter: "saved",
            itemId: undefined,
          }),
        }),
    },
  ];

  const pinnedItems = [
    { label: "Watchlists", icon: BookmarkFill },
    { label: "Accounts", icon: BookmarkFill },
  ];

  return (
    <SidebarHeader className="gap-2 px-2 pb-4">
      <SidebarMenu>
        <SidebarMenuItem>
          <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
            <CommandDialogTrigger
              render={
                <SidebarMenuButton className="font-medium">
                  <span className="min-w-0 flex-1 truncate">Cronos Workspace</span>
                  <SelectorVerticalLine className="-me-1 size-6 shrink-0" />
                </SidebarMenuButton>
              }
            />
            <CommandDialogPopup>
              <Command>
                <CommandInput placeholder="Search workspace..." />
                <CommandPanel>
                  <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    <CommandGroup>
                      <CommandGroupLabel>Inbox</CommandGroupLabel>
                      {commandItems.map((item) => (
                        <CommandItem
                          key={item.label}
                          value={item.label}
                          onClick={() => {
                            void item.action();
                            setCommandOpen(false);
                          }}
                        >
                          <item.icon className="me-2 size-4" />
                          <span>{item.label}</span>
                          <CommandShortcut>{item.shortcut}</CommandShortcut>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                    <CommandGroup>
                      <CommandGroupLabel>Pinned</CommandGroupLabel>
                      {pinnedItems.map((item) => (
                        <CommandItem key={item.label} value={item.label} disabled>
                          <item.icon className="me-2 size-4" />
                          <span>{item.label}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </CommandPanel>
                <CommandFooter>
                  <span>Workspace navigation</span>
                  <CommandShortcut>{isMacPlatform ? "⌘K" : "Ctrl K"}</CommandShortcut>
                </CommandFooter>
              </Command>
            </CommandDialogPopup>
          </CommandDialog>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarFeedSearchTrigger isMacPlatform={isMacPlatform} />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}
