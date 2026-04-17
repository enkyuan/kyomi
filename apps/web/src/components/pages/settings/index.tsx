"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { FileImportFill } from "@mingcute/react";
import { authClient } from "@lib/auth-client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@components/ui/breadcrumb";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@components/ui/sidebar";
import { Separator } from "@components/ui/separator";
import { toastManager } from "@components/ui/toast";
import { AccountPageNav, AccountPagePanel, accountSection } from "./account-page";
import { AdvancedPageNav, AdvancedPagePanel, advancedSection } from "./advanced-page";
import { InboxPageNav, InboxPagePanel, inboxSection } from "./inbox-page";
import { ReaderPageNav, ReaderPagePanel, readerSection } from "./reader-page";

const SETTINGS_NAV = [
  accountSection,
  readerSection,
  inboxSection,
  advancedSection,
  { name: "Import OPML" },
] as const;
const DEFAULT_ACTIVE_SECTION_NAME = SETTINGS_NAV[0]?.name ?? "Account";

type SettingsDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const router = useRouter();
  const [activeSectionName, setActiveSectionName] = useState<string>(DEFAULT_ACTIVE_SECTION_NAME);

  const handleLogout = async () => {
    await toastManager.promise(
      (async () => {
        const result = await authClient.signOut();

        if (result?.error) {
          throw new Error(result.error.message?.trim() || "Unable to log out");
        }

        onOpenChange(false);
        await router.invalidate();
        await router.navigate({ to: "/" });
      })(),
      {
        error: (error) => ({
          description: error instanceof Error ? error.message : "Unable to log out",
          title: "Log out failed",
          type: "error",
        }),
        loading: {
          description: "Ending your current session.",
          timeout: 0,
          title: "Logging out...",
          type: "loading",
        },
        success: {
          description: "You have been signed out.",
          title: "Logged out",
          type: "success",
        },
      },
    );
  };

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
                    <ReaderPageNav
                      isActive={activeSectionName === readerSection.name}
                      onSelect={() => {
                        setActiveSectionName(readerSection.name);
                      }}
                    />
                    <InboxPageNav
                      isActive={activeSectionName === inboxSection.name}
                      onSelect={() => {
                        setActiveSectionName(inboxSection.name);
                      }}
                    />
                    <AdvancedPageNav
                      isActive={activeSectionName === advancedSection.name}
                      onSelect={() => {
                        setActiveSectionName(advancedSection.name);
                      }}
                    />
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        isActive={activeSectionName === "Import OPML"}
                        onClick={() => {
                          setActiveSectionName("Import OPML");
                        }}
                      >
                        <FileImportFill />
                        <span>Import OPML</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
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
                <AccountPagePanel onLogout={handleLogout} />
              ) : null}
              {activeSectionName === readerSection.name ? <ReaderPagePanel /> : null}
              {activeSectionName === inboxSection.name ? <InboxPagePanel /> : null}
              {activeSectionName === advancedSection.name ? <AdvancedPagePanel /> : null}
              {activeSectionName === "Import OPML" ? (
                <section className="space-y-1">
                  <h2 className="text-base font-semibold">Import OPML</h2>
                  <p className="text-sm text-muted-foreground">
                    Import your OPML file to quickly add feed subscriptions.
                  </p>
                </section>
              ) : null}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}
