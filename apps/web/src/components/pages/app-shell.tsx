"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@components/ui/app-sidebar";
import { SidebarInset, SidebarProvider } from "@components/ui/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-[100dvh] w-full overflow-hidden">
        <AppSidebar />

        <SidebarInset className="min-h-0 min-w-0 flex-1 bg-transparent p-0 md:peer-data-[variant=inset]:my-1 md:peer-data-[variant=inset]:me-1 md:peer-data-[variant=inset]:ms-0">
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
