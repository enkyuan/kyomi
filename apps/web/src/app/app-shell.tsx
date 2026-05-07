"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  APP_SIDEBAR_WIDTH,
  APP_SIDEBAR_WIDTH_READER_FOCUS,
  AppSidebar,
} from "@components/ui/app-sidebar";
import { SidebarInset, SidebarProvider } from "@components/ui/sidebar";

const READER_FOCUS_LIST_MAX_WIDTH = "44rem";
const READER_FOCUS_LIST_WIDTH = "min(100%, var(--reader-focus-list-max-width))";
const READER_FOCUS_LEFT_GUTTER = `max(0px, calc((100% - ${READER_FOCUS_LIST_WIDTH}) / 2 - var(--sidebar-width)))`;
const READER_FOCUS_RIGHT_GUTTER = `max(0px, calc((100% - ${READER_FOCUS_LIST_WIDTH}) / 2))`;
const DEFAULT_GRID_TEMPLATE_COLUMNS = "auto minmax(0, 1fr)";

export function AppShell({
  children,
  readerFocusList = false,
}: {
  children: ReactNode;
  readerFocusList?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, duration: 0.38, bounce: 0 };

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <SidebarProvider data-reader-focus-sidebar={readerFocusList ? "true" : undefined} defaultOpen>
      <motion.div
        initial={false}
        layout={isMounted ? true : undefined}
        className="grid h-dvh max-h-dvh min-h-0 w-full overflow-hidden"
        style={
          {
            "--sidebar-width": readerFocusList ? APP_SIDEBAR_WIDTH_READER_FOCUS : APP_SIDEBAR_WIDTH,
            "--reader-focus-list-max-width": READER_FOCUS_LIST_MAX_WIDTH,
            gridTemplateColumns: readerFocusList
              ? `${READER_FOCUS_LEFT_GUTTER} auto minmax(0, ${READER_FOCUS_LIST_WIDTH}) ${READER_FOCUS_RIGHT_GUTTER}`
              : DEFAULT_GRID_TEMPLATE_COLUMNS,
          } as CSSProperties
        }
        transition={transition}
      >
        <motion.div
          initial={false}
          layout={isMounted ? true : undefined}
          layoutId="app-sidebar-shell"
          className="min-h-0"
          style={readerFocusList ? { gridColumn: "2" } : { gridColumn: "1" }}
          transition={transition}
        >
          <AppSidebar
            readerFocusSidebar={readerFocusList}
            style={
              {
                "--sidebar-width": readerFocusList
                  ? APP_SIDEBAR_WIDTH_READER_FOCUS
                  : APP_SIDEBAR_WIDTH,
              } as CSSProperties
            }
          />
        </motion.div>
        <motion.div
          initial={false}
          layout={isMounted ? true : undefined}
          layoutId="app-main-shell"
          className="min-h-0 min-w-0"
          style={readerFocusList ? { gridColumn: "3" } : { gridColumn: "2" }}
          transition={transition}
        >
          <SidebarInset
            className={`h-full max-h-full min-h-0 min-w-0 overflow-hidden bg-transparent p-0 md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:ms-0 ${readerFocusList ? "w-full max-w-4xl" : "flex-1"}`}
          >
            {children}
          </SidebarInset>
        </motion.div>
      </motion.div>
    </SidebarProvider>
  );
}
