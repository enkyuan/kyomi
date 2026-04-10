"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@components/ui/app-sidebar";
import { SidebarInset, SidebarProvider } from "@components/ui/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-[100dvh] max-h-[100dvh] min-h-0 w-full overflow-hidden">
        <AppSidebar />

        <SidebarInset className="h-full max-h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-transparent p-0 pb-2 md:peer-data-[variant=inset]:my-1 md:peer-data-[variant=inset]:me-1 md:peer-data-[variant=inset]:ms-0">
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
