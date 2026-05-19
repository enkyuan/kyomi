"use client";

import { useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode } from "react";
import { LazyMotion, domMax, m, useReducedMotion } from "motion/react";
import {
  APP_SIDEBAR_WIDTH,
  APP_SIDEBAR_WIDTH_READER_FOCUS,
  AppSidebar,
} from "@components/navigation/app-sidebar";
import { SidebarInset, SidebarProvider } from "@components/ui/sidebar";

const GRID_TEMPLATE_COLUMNS = "auto minmax(0, 1fr)";

export function AppShell({
  children,
  readerFocusMode = false,
}: {
  children: ReactNode;
  /** Tablet reader layout: wider nav sidebar, detail fills main. */
  readerFocusMode?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.38, bounce: 0 };

  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <SidebarProvider data-reader-focus-sidebar={readerFocusMode ? "true" : undefined} defaultOpen>
      <LazyMotion features={domMax}>
        <m.div
          initial={false}
          layout={isMounted ? true : undefined}
          className="grid h-dvh max-h-dvh min-h-0 w-full overflow-hidden"
          style={
            {
              "--sidebar-width": readerFocusMode
                ? APP_SIDEBAR_WIDTH_READER_FOCUS
                : APP_SIDEBAR_WIDTH,
              gridTemplateColumns: GRID_TEMPLATE_COLUMNS,
            } as CSSProperties
          }
          transition={transition}
        >
          <m.div
            initial={false}
            layout={isMounted ? true : undefined}
            layoutId="app-sidebar-shell"
            className="min-h-0"
            style={{ gridColumn: "1" }}
            transition={transition}
          >
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
          </m.div>
          <m.div
            initial={false}
            layout={isMounted ? true : undefined}
            layoutId="app-main-shell"
            className="min-h-0 min-w-0"
            style={{ gridColumn: "2" }}
            transition={transition}
          >
            <SidebarInset
              className={`h-full max-h-full min-h-0 min-w-0 overflow-hidden bg-transparent p-0 md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:ms-0 ${readerFocusMode ? "w-full" : "flex-1"}`}
            >
              {children}
            </SidebarInset>
          </m.div>
        </m.div>
      </LazyMotion>
    </SidebarProvider>
  );
}
