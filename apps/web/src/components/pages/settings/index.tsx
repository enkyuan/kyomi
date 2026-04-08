"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
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
  SidebarProvider,
} from "@components/ui/sidebar";
import { Separator } from "@components/ui/separator";
import { toastManager } from "@components/ui/toast";
import { AccountPageNav, AccountPagePanel, accountSection } from "./account-page";
import { AdvancedPageNav, AdvancedPagePanel, advancedSection } from "./advanced-page";
import {
  InboxBehaviorPageNav,
  InboxBehaviorPagePanel,
  inboxBehaviorSection,
} from "./inbox-behavior-page";
import { ReaderPageNav, ReaderPagePanel, readerSection } from "./reader-page";

const SETTINGS_NAV = [
  accountSection,
  readerSection,
  inboxBehaviorSection,
  advancedSection,
] as const;

type SettingsDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const router = useRouter();
  const [activeSectionName, setActiveSectionName] = useState<string>(SETTINGS_NAV[0]!.name);

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
            className="hidden h-full w-64 border-r border-border bg-sidebar md:flex"
          >
            <SidebarContent className="gap-0">
              <SidebarGroup className="p-3">
                <SidebarGroupContent>
                  <SidebarMenu>
                    <AccountPageNav
                      isActive={activeSectionName === "Account"}
                      onSelect={() => {
                        setActiveSectionName("Account");
                      }}
                    />
                    <ReaderPageNav
                      isActive={activeSectionName === "Reader"}
                      onSelect={() => {
                        setActiveSectionName("Reader");
                      }}
                    />
                    <InboxBehaviorPageNav
                      isActive={activeSectionName === "Inbox behavior"}
                      onSelect={() => {
                        setActiveSectionName("Inbox behavior");
                      }}
                    />
                    <AdvancedPageNav
                      isActive={activeSectionName === "Advanced"}
                      onSelect={() => {
                        setActiveSectionName("Advanced");
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
              {activeSectionName === "Account" ? (
                <AccountPagePanel onLogout={handleLogout} />
              ) : null}
              {activeSectionName === "Reader" ? <ReaderPagePanel /> : null}
              {activeSectionName === "Inbox behavior" ? <InboxBehaviorPagePanel /> : null}
              {activeSectionName === "Advanced" ? <AdvancedPagePanel /> : null}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}
