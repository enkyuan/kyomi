"use client";

import { useState } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@kyomi/ui/breadcrumb";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@kyomi/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarProvider,
} from "@kyomi/ui/sidebar";
import { Separator } from "@kyomi/ui/separator";
import { AccountPageNav, AccountPagePanel, accountSection } from "../account";
import { AdvancedPageNav, AdvancedPagePanel, advancedSection } from "../advanced";
import { AppearancePageNav, AppearancePagePanel, appearanceSection } from "../appearance";
import { BillingPageNav, BillingPagePanel, billingSection } from "../billing";
import {
  PersonalizationPageNav,
  PersonalizationPagePanel,
  personalizationSection,
} from "../personalization";
import { useSettingsLogout } from "@modules/settings/hooks/use-settings-logout";

const DEFAULT_ACTIVE_SECTION_NAME = accountSection.name;

type SettingsDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeSectionName, setActiveSectionName] = useState<string>(DEFAULT_ACTIVE_SECTION_NAME);
  const { logout } = useSettingsLogout({ onOpenChange });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 md:max-h-135 md:max-w-205">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">Configure workspace settings.</DialogDescription>
        <SidebarProvider className="h-full items-start bg-popover">
          <Sidebar
            collapsible="none"
            className="hidden h-full w-48 border-r border-border bg-sidebar md:flex"
          >
            <SidebarContent className="gap-0">
              <SidebarGroup className="p-3">
                <SidebarGroupContent>
                  <SidebarMenu>
                    <AccountPageNav
                      isActive={activeSectionName === accountSection.name}
                      onSelect={() => {
                        setActiveSectionName(accountSection.name);
                      }}
                    />
                    <AppearancePageNav
                      isActive={activeSectionName === appearanceSection.name}
                      onSelect={() => {
                        setActiveSectionName(appearanceSection.name);
                      }}
                    />
                    <PersonalizationPageNav
                      isActive={activeSectionName === personalizationSection.name}
                      onSelect={() => {
                        setActiveSectionName(personalizationSection.name);
                      }}
                    />
                    <BillingPageNav
                      isActive={activeSectionName === billingSection.name}
                      onSelect={() => {
                        setActiveSectionName(billingSection.name);
                      }}
                    />
                    <AdvancedPageNav
                      isActive={activeSectionName === advancedSection.name}
                      onSelect={() => {
                        setActiveSectionName(advancedSection.name);
                      }}
                    />
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex h-135 min-w-0 flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center ps-5 pe-14">
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">Settings</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{activeSectionName}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>
            <Separator />
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
              {activeSectionName === accountSection.name ? (
                <AccountPagePanel onLogout={logout} />
              ) : null}
              {activeSectionName === appearanceSection.name ? <AppearancePagePanel /> : null}
              {activeSectionName === personalizationSection.name ? (
                <PersonalizationPagePanel />
              ) : null}
              {activeSectionName === billingSection.name ? <BillingPagePanel /> : null}
              {activeSectionName === advancedSection.name ? <AdvancedPagePanel /> : null}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}
