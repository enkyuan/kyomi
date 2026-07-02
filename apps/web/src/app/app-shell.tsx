"use client";

import type { CSSProperties, ReactNode } from "react";
import { AppSidebar } from "@modules/sidebar/components/app-sidebar";
import { APP_SIDEBAR_WIDTH } from "@modules/sidebar/lib/constants";
import { SidebarInset, SidebarProvider } from "@kyomi/ui/sidebar";

const GRID_TEMPLATE_COLUMNS = "auto minmax(0, 1fr)";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <div className="relative flex h-dvh max-h-dvh min-h-0 w-full justify-center overflow-hidden">
        <div
          className="relative grid h-full min-h-0 w-full overflow-visible"
          style={
            {
              "--sidebar-width": APP_SIDEBAR_WIDTH,
              maxWidth: "84rem",
              gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
            } as CSSProperties
          }
        >
          <div
            className="relative min-h-0 bg-sidebar before:pointer-events-none before:absolute before:inset-y-0 before:right-full before:w-screen before:bg-sidebar"
            style={{ gridColumn: "1" }}
          >
            <AppSidebar style={{ "--sidebar-width": APP_SIDEBAR_WIDTH } as CSSProperties} />
          </div>
          <div className="min-h-0 min-w-0 overflow-hidden" style={{ gridColumn: "2" }}>
            <SidebarInset className="h-full max-h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-transparent p-0 md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:ms-0">
              {children}
            </SidebarInset>
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
