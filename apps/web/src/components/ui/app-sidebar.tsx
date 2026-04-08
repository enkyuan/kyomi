"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate, Link } from "@tanstack/react-router";
import {
  BookmarkFill,
  Chat3Fill,
  InboxFill,
  NewsFill,
  PhoneFill,
  SelectorVerticalLine,
  Settings3Fill,
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
import { SettingsDialog } from "src/components/pages/settings";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@components/ui/sidebar";
import { getInboxItems } from "@lib/inbox-functions";

type InboxNavSearch = {
  source?: "reddit" | "x";
  status?: "new" | "saved" | "dismissed" | "replied" | "converted";
  sort?: "rank" | "recent";
};

const INBOX_NAV: Array<{
  label: string;
  to: "/inbox";
  search: InboxNavSearch;
  icon: typeof InboxFill;
}> = [
  {
    label: "Today",
    to: "/inbox",
    search: {},
    icon: InboxFill,
  },
  {
    label: "All Unread",
    to: "/inbox",
    search: { status: "new" as const, sort: "recent" as const },
    icon: NewsFill,
  },
  {
    label: "Starred",
    to: "/inbox",
    search: { status: "saved" as const },
    icon: StarFill,
  },
];

const FILTER_KEYS = ["source", "status", "sort"] as const;

const FOOTER_NAV = [
  { label: "Support", icon: PhoneFill },
  { label: "Feedback", icon: Chat3Fill },
  { label: "Settings", icon: Settings3Fill },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [commandOpen, setCommandOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const inboxSummaryQuery = useQuery({
    queryKey: ["sidebar", "inbox-summary"],
    queryFn: () =>
      getInboxItems({
        data: {
          source: undefined,
          status: undefined,
          search: undefined,
          sort: undefined,
        },
      }),
  });
  const unreadCount = Array.isArray(inboxSummaryQuery.data?.items)
    ? inboxSummaryQuery.data.items.filter((item) => item.state === "new").length
    : 0;

  const commandItems = [
    {
      label: "Today",
      shortcut: "G I",
      icon: InboxFill,
      action: () =>
        navigate({
          to: "/inbox",
          search: () => ({
            source: undefined,
            status: undefined,
            sort: undefined,
            search: undefined,
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
            status: "new" as const,
            sort: "recent" as const,
            itemId: undefined,
          }),
        }),
    },
    {
      label: "Starred",
      shortcut: "G S",
      icon: StarFill,
      action: () =>
        navigate({
          to: "/inbox",
          search: (prev) => ({
            ...prev,
            status: "saved" as const,
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
    <Sidebar
      side="left"
      variant="inset"
      collapsible="icon"
      className="p-0 pe-0 ps-2 py-2 group-data-[collapsible=icon]:**:data-[sidebar=menu-item]:flex group-data-[collapsible=icon]:**:data-[sidebar=menu-item]:justify-start group-data-[collapsible=icon]:**:data-[sidebar=menu-button]:justify-start group-data-[collapsible=icon]:**:data-[sidebar=menu-button]:px-2"
      style={{ "--sidebar-width": "13rem" } as CSSProperties}
    >
      <SidebarHeader className="gap-2 px-0 pb-4">
        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
          <CommandDialogTrigger className="flex h-8 w-full items-center gap-2 rounded-lg border-0 bg-transparent px-4 py-0 text-left text-sm font-medium text-foreground shadow-none ring-0 outline-none focus-visible:ring-0">
            <span className="truncate">Cronos Workspace</span>
            <SelectorVerticalLine className="ms-auto size-6 shrink-0" />
          </CommandDialogTrigger>
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
                <CommandShortcut>Esc</CommandShortcut>
              </CommandFooter>
            </Command>
          </CommandDialogPopup>
        </CommandDialog>
      </SidebarHeader>

      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup className="gap-1">
          <SidebarGroupLabel>Inbox</SidebarGroupLabel>
          <SidebarMenu>
            {INBOX_NAV.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  activeAdornment={
                    item.label === "Today" && unreadCount > 0 ? (
                      <span className="flex size-5 items-center justify-center rounded-full bg-sidebar-foreground/10 px-1 text-[11px] font-semibold text-sidebar-foreground tabular-nums">
                        {unreadCount}
                      </span>
                    ) : null
                  }
                  isActive={
                    location.pathname === "/inbox" &&
                    FILTER_KEYS.every((key) => {
                      const expected = item.search[key];
                      const actual = location.search[key];
                      return expected === undefined ? actual === undefined : actual === expected;
                    })
                  }
                  tooltip={item.label}
                  render={
                    <Link
                      to={item.to}
                      search={(prev) => ({
                        ...prev,
                        ...item.search,
                        itemId: undefined,
                      })}
                    />
                  }
                >
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup className="gap-1">
          <SidebarGroupLabel>Pinned</SidebarGroupLabel>
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
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-2 pt-0">
        <SidebarMenu>
          {FOOTER_NAV.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                tooltip={item.label}
                className={item.label === "Settings" ? undefined : "opacity-72"}
                onClick={
                  item.label === "Settings"
                    ? () => {
                        setSettingsOpen(true);
                      }
                    : undefined
                }
              >
                <item.icon />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarFooter>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Sidebar>
  );
}
