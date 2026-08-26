"use client";

import type { CSSProperties, ReactNode } from "react";
import { AppSidebar } from "@modules/sidebar/components/app-sidebar";
import { APP_SIDEBAR_WIDTH } from "@modules/sidebar/lib/constants";
import { SidebarInset, SidebarProvider } from "@kyomi/ui/sidebar";

const GRID_TEMPLATE_COLUMNS = "auto minmax(0, 1fr)";

// Graduated content-width ceiling: fills the viewport below `xl`, then steps up at each wide
// tier instead of freezing at one width forever. Keep in sync with the recap rail's width ladder
// in modules/inbox/components/page/recap.tsx and the --breakpoint-* tokens in packages/ui/src/styles/theme.css.
// Deliberately not transitioned: max-width forces layout, and this can fire continuously while
// the user drags an OS window edge, so animating it would fight the performance guidance to only
// animate transform/opacity.
const SHELL_MAX_WIDTH_CLASS =
  "max-w-none xl:max-w-[84rem] 2xl:max-w-[90rem] 3xl:max-w-[100rem] 4xl:max-w-[112rem]";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <div className="relative flex h-dvh max-h-dvh min-h-0 w-full justify-center overflow-hidden">
        <div
          data-slot="app-shell-content"
          className={`relative grid h-full min-h-0 w-full overflow-visible ${SHELL_MAX_WIDTH_CLASS}`}
          style={
            {
              "--sidebar-width": APP_SIDEBAR_WIDTH,
              gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
              paddingInline: "calc(var(--sidebar-width) + 2rem)",
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
