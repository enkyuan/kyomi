"use client";

import type { CSSProperties, ReactNode } from "react";
import { APP_SIDEBAR_WIDTH, AppSidebar } from "@components/ui/app-sidebar";
import { SidebarInset, SidebarProvider } from "@components/ui/sidebar";

const READER_FOCUS_LIST_MAX_WIDTH = "40rem";
const READER_FOCUS_LIST_WIDTH = "min(100%, var(--reader-focus-list-max-width))";
const READER_FOCUS_LEFT_GUTTER = `max(0px, calc((100% - ${READER_FOCUS_LIST_WIDTH}) / 2 - var(--sidebar-width)))`;
const READER_FOCUS_RIGHT_GUTTER = `max(0px, calc((100% - ${READER_FOCUS_LIST_WIDTH}) / 2))`;

export function AppShell({
  children,
  readerFocusList = false,
}: {
  children: ReactNode;
  readerFocusList?: boolean;
}) {
  return (
    <SidebarProvider defaultOpen>
      <div
        className={
          readerFocusList
            ? "grid h-dvh max-h-dvh min-h-0 w-full overflow-hidden"
            : "flex h-dvh max-h-dvh min-h-0 w-full overflow-hidden"
        }
        style={
          readerFocusList
            ? ({
                "--sidebar-width": APP_SIDEBAR_WIDTH,
                "--reader-focus-list-max-width": READER_FOCUS_LIST_MAX_WIDTH,
                gridTemplateColumns: `${READER_FOCUS_LEFT_GUTTER} auto minmax(0, ${READER_FOCUS_LIST_WIDTH}) ${READER_FOCUS_RIGHT_GUTTER}`,
              } as CSSProperties)
            : undefined
        }
      >
        <AppSidebar style={readerFocusList ? { gridColumn: "2" } : undefined} />
        <SidebarInset
          className={`h-full max-h-full min-h-0 min-w-0 overflow-hidden bg-transparent p-0 md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:ms-0 ${readerFocusList ? "w-full max-w-4xl" : "flex-1"}`}
          style={readerFocusList ? { gridColumn: "3" } : undefined}
        >
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
