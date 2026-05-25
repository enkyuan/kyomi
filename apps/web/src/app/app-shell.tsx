"use client";

import type { CSSProperties, ReactNode } from "react";
import { AppSidebar } from "@modules/sidebar/components/app-sidebar";
import { APP_SIDEBAR_WIDTH, APP_SIDEBAR_WIDTH_READER_FOCUS } from "@modules/sidebar/lib/constants";
import { SidebarInset, SidebarProvider } from "@vols.rss/ui/sidebar";

const GRID_TEMPLATE_COLUMNS = "auto minmax(0, 1fr)";

export function AppShell({
  children,
  readerFocusMode = false,
}: {
  children: ReactNode;
  /** Tablet reader layout: wider nav sidebar, detail fills main. */
  readerFocusMode?: boolean;
}) {
  return (
    <SidebarProvider data-reader-focus-sidebar={readerFocusMode ? "true" : undefined} defaultOpen>
      <div
        className="grid h-dvh max-h-dvh min-h-0 w-full overflow-hidden"
        style={
          {
            "--sidebar-width": readerFocusMode ? APP_SIDEBAR_WIDTH_READER_FOCUS : APP_SIDEBAR_WIDTH,
            gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
          } as CSSProperties
        }
      >
        <div className="min-h-0" style={{ gridColumn: "1" }}>
          <AppSidebar
            readerFocusSidebar={readerFocusMode}
            style={
              {
                "--sidebar-width": readerFocusMode
                  ? APP_SIDEBAR_WIDTH_READER_FOCUS
                  : APP_SIDEBAR_WIDTH,
              } as CSSProperties
            }
          />
        </div>
        <div className="min-h-0 min-w-0" style={{ gridColumn: "2" }}>
          <SidebarInset
            className={`h-full max-h-full min-h-0 min-w-0 overflow-hidden bg-transparent p-0 md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:ms-0 ${readerFocusMode ? "w-full" : "flex-1"}`}
          >
            {children}
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
