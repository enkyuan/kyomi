"use client";

import type { ReactNode } from "react";
import { AppSidebar } from "@components/ui/app-sidebar";
import { SidebarInset, SidebarProvider } from "@components/ui/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-dvh max-h-dvh min-h-0 w-full has-data-reader-focus-list:mx-auto has-data-reader-focus-list:max-w-4xl overflow-hidden transition-[max-width,margin] duration-300 ease-in-out">
        <AppSidebar />

        <SidebarInset className="h-full max-h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-transparent p-0 pb-2 md:peer-data-[variant=inset]:my-1 md:peer-data-[variant=inset]:me-1 md:peer-data-[variant=inset]:ms-0">
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
