"use client";

import type { ComponentType } from "react";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  Bill2Fill,
  BrushFill,
  HeadAiFill,
  Message3Fill,
  SwitchFill,
  User3Fill,
} from "@mingcute/react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@kyomi/ui/breadcrumb";
import { ScrollArea } from "@kyomi/ui/scroll-area";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@kyomi/ui/sidebar";
import { Separator } from "@kyomi/ui/separator";
import { accountSection } from "../account";
import { advancedSection } from "../advanced";
import { appearanceSection } from "../appearance";
import { billingSection } from "../billing";
import { feedbackSection } from "../feedback";
import { personalizationSection } from "../personalization";

type SettingsSectionRoute = {
  Icon: ComponentType<{ className?: string }>;
  name: string;
  to: string;
};

const SETTINGS_SECTION_ROUTES: SettingsSectionRoute[] = [
  {
    Icon: User3Fill,
    name: accountSection.name,
    to: "/settings/account",
  },
  {
    Icon: BrushFill,
    name: appearanceSection.name,
    to: "/settings/appearance",
  },
  {
    Icon: HeadAiFill,
    name: personalizationSection.name,
    to: "/settings/personalization",
  },
  {
    Icon: Bill2Fill,
    name: billingSection.name,
    to: "/settings/billing",
  },
  {
    Icon: Message3Fill,
    name: feedbackSection.name,
    to: "/settings/feedback",
  },
  {
    Icon: SwitchFill,
    name: advancedSection.name,
    to: "/settings/advanced",
  },
];

function getActiveSectionName(pathname: string) {
  return (
    SETTINGS_SECTION_ROUTES.find(
      (section) => pathname === section.to || pathname.startsWith(`${section.to}/`),
    )?.name ?? accountSection.name
  );
}

export function SettingsPageLayout() {
  const location = useLocation();
  const activeSectionName = getActiveSectionName(location.pathname);

  return (
    <SidebarProvider className="h-full min-h-0 items-start bg-transparent">
      <div className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden pe-3">
        <Sidebar
          collapsible="none"
          className="hidden h-full w-52 border-r border-border bg-transparent md:flex"
        >
          <SidebarContent className="gap-0">
            <SidebarGroup className="px-3 py-8">
              <SidebarGroupContent>
                <SidebarMenu>
                  {SETTINGS_SECTION_ROUTES.map(({ Icon, name, to }) => (
                    <SidebarMenuItem key={to}>
                      <SidebarMenuButton
                        isActive={activeSectionName === name}
                        render={<Link to={to} />}
                      >
                        <Icon className="size-4" />
                        <span>{name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center px-5 md:px-6">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink render={<Link to="/settings/account" />}>Settings</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{activeSectionName}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <Separator />
          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-5 py-6 md:px-8">
              <Outlet />
            </div>
          </ScrollArea>
        </main>
      </div>
    </SidebarProvider>
  );
}
